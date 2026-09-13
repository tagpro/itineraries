/* Finding Chromium without dragging in Playwright's full download.
   playwright-core drives a browser but ships none, so the executable is
   looked up in the places it actually turns up: an explicit CHROME_PATH,
   a Playwright-managed build, then the usual macOS and Linux installs. */
import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';

/* Ask playwright-core first: it knows the cache location for this platform,
   which a hand-built path does not (~/.cache on Linux, ~/Library/Caches on
   macOS). But it answers with the build this package version wants, which is
   not always the build that is installed — on the machine this was written on
   it names chromium-1187 while only 1194 exists — so the answer is checked,
   and a near miss falls through to whatever chromium is actually there. */
function managed() {
  try {
    const declared = chromium.executablePath();
    if (declared && existsSync(declared)) return declared;
  } catch { /* no registry entry; fall through to looking around */ }

  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    `${process.env.HOME}/.cache/ms-playwright`,
    `${process.env.HOME}/Library/Caches/ms-playwright`,
  ].filter(dir => dir && existsSync(dir));

  for (const root of roots) {
    for (const dir of readdirSync(root).filter(d => d.startsWith('chromium')).sort().reverse()) {
      for (const rel of ['chrome-linux/chrome',
                         'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
                         'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium']) {
        const p = path.join(root, dir, rel);
        if (existsSync(p)) return p;
      }
    }
  }
  return null;
}

function onPath() {
  for (const bin of ['chromium', 'chromium-browser', 'google-chrome']) {
    try { return execSync(`command -v ${bin}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
    catch { /* not installed */ }
  }
  return null;
}

export function chromePath() {
  const found = [
    process.env.CHROME_PATH,
    managed(),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    onPath(),
  ].find(p => p && existsSync(p));
  if (!found) {
    throw new Error('No Chromium found. Set CHROME_PATH, or run: npx playwright install chromium');
  }
  return found;
}

export const launch = () => chromium.launch({ executablePath: chromePath() });

/* A results collector, so a spec reads as a list of claims about the page
   rather than a pile of asserts that stop at the first failure. */
export function report(name) {
  const lines = [];
  return {
    ok(what, pass, detail = '') {
      lines.push(`${pass ? 'PASS' : 'FAIL'}  ${what}${detail ? ' — ' + detail : ''}`);
    },
    finish() {
      const failed = lines.filter(l => l.startsWith('FAIL')).length;
      console.log(`\n${name}\n${'-'.repeat(name.length)}`);
      console.log(lines.join('\n'));
      console.log(failed ? `\n${failed} failed` : '\nall good');
      return failed;
    },
  };
}

export const PHONE   = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
export const DESKTOP = { viewport: { width: 1280, height: 900 } };
export const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';

/* Which sections are on screen. One at a time is the whole design, so most
   assertions here come down to this list. */
export const visible = pg =>
  pg.$$eval('.pane', ps => ps.filter(p => getComputedStyle(p).display !== 'none').map(p => p.id).join(','));

export const budgetRows = pg =>
  pg.$$eval('[data-brows] [data-bk]', es => es.map(e => ({
    k: e.dataset.bk,
    t: e.querySelector('.text-sm.font-medium').textContent,
    p: e.querySelector('[data-bf="p"]').value,
    a: e.querySelector('[data-bf="a"]').value,
  })));

/* Whether the menu needs opening is a question about the menu, not about
   the hamburger: above 1024px there is no hamburger, and below it the
   open drawer covers the button, so asking the button gets it wrong both
   ways. Specs should not have to care which width they are running at. */
export const menuOpen = pg =>
  pg.locator('#menu').evaluate(m => m.getBoundingClientRect().left >= 0);

export async function openMenu(pg) {
  if (!(await menuOpen(pg))) {
    await pg.click('#menu-btn');
    await pg.waitForTimeout(300);   // the drawer slides
  }
}

export async function go(pg, section) {
  await openMenu(pg);
  await pg.click(`.navrow[data-sec="${section}"] .navitem`);
}
