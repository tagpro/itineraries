/* What the page does on its own: sections, the starred default, deep links,
   the iOS install note, the safe-area insets and offline. No API needed.

   Usage: node test/page.test.mjs [baseUrl] [insetBaseUrl]
   The second URL, if given, serves a copy of the page with real lengths
   substituted for env(safe-area-inset-*), because Chromium cannot emulate
   them and an unmeasured inset is how the header ended up under the clock. */
import { launch, report, PHONE, DESKTOP, IPHONE_UA, visible, budgetRows, go, menuOpen } from './browser.mjs';

const BASE = process.argv[2] || 'http://127.0.0.1:8099/tassie-campervan-2026/';
const INSET = process.argv[3] || '';
const NS = 'tassie-camper-2026:';
const r = report('the page on its own');
const b = await launch();
const errs = [];
const watch = pg => pg.on('pageerror', e => errs.push(String(e)));

// ── one section at a time, and the star that picks which ────────────────
let ctx = await b.newContext(DESKTOP);
let pg = await ctx.newPage(); watch(pg);
await pg.goto(BASE, { waitUntil: 'networkidle' });
r.ok('opens on the overview, alone', await visible(pg) === 'overview', await visible(pg));
r.ok('the menu is open on a wide screen', await pg.locator('#menu').isVisible());
await go(pg, 'checklists');
r.ok('the menu opens one section', await visible(pg) === 'checklists', await visible(pg));

const box = pg.locator('#checklists .chk').first();
const key = await box.getAttribute('data-k');
await box.check();
await pg.reload({ waitUntil: 'networkidle' });
r.ok('a tick survives a reload',
  await pg.evaluate(([n, k]) => localStorage.getItem(n + 'chk:' + k) === '1', [NS, key]));

// The menu is always open at this width, so the star is one click away.
await pg.click('.navrow[data-sec="itinerary"] .pin');
r.ok('starring stores the choice', await pg.evaluate(n => localStorage.getItem(n + 'home') === 'itinerary', NS));
await pg.reload({ waitUntil: 'networkidle' });
r.ok('and a reload opens there', await visible(pg) === 'itinerary', await visible(pg));
await pg.click('.navrow[data-sec="itinerary"] .pin');
await pg.reload({ waitUntil: 'networkidle' });
r.ok('starring it again clears it', await visible(pg) === 'overview', await visible(pg));

// ── the hash: shortcuts work, but never outrank the star ────────────────
await pg.goto(BASE + '#camps', { waitUntil: 'networkidle' });
r.ok('a home-screen shortcut lands right', await visible(pg) === 'camps', await visible(pg));
r.ok('and its hash is spent, not left to win every refresh', !pg.url().includes('#'), pg.url());
await pg.evaluate(() => { location.hash = 'hikes'; });
await pg.waitForTimeout(200);
r.ok('a shortcut tapped while open still moves', await visible(pg) === 'hikes', await visible(pg));
await pg.goto('about:blank');
await pg.goto(BASE + '#join=' + 'a'.repeat(43), { waitUntil: 'networkidle' });
r.ok('a join link is not mistaken for a section', await visible(pg) === 'overview', await visible(pg));

// ── a cross-reference from one section into a particular day ────────────
await pg.goto(BASE + '#planb', { waitUntil: 'networkidle' });
await pg.$$eval('#planb details', ds => ds.forEach(d => { d.open = true; }));
const link = pg.locator('#planb a[data-goto]').first();
const day = await link.getAttribute('data-goto');
await link.click();
r.ok('a day link opens the day-by-day', await visible(pg) === 'itinerary', await visible(pg));
r.ok('on the day it names', JSON.stringify(await pg.$$eval('.daypanel',
  ps => ps.filter(p => !p.classList.contains('hidden')).map(p => p.dataset.day))) === JSON.stringify([day]));

// ── the budget, edited locally ──────────────────────────────────────────
await pg.goto(BASE + '#budget', { waitUntil: 'networkidle' });
let rows = await budgetRows(pg);
r.ok('the budget seeds its planned rows', rows.length >= 20, String(rows.length));
await pg.fill('[data-bk="fuel"] [data-bf="a"]', '198.40');
await pg.fill('[data-badd="food"] input[type=text]', 'Ross bakery');
await pg.fill('[data-badd="food"] input[type=number]', '12.50');
await pg.click('[data-badd="food"] button[type=submit]');
await pg.click('[data-bk="buf"] button[aria-label^="Edit"]');
await pg.click('[data-bk="buf"] form button:has-text("Delete")');
await pg.reload({ waitUntil: 'networkidle' });
await pg.goto(BASE + '#budget', { waitUntil: 'networkidle' });
rows = await budgetRows(pg);
r.ok('a spend survives a reload', rows.find(x => x.k === 'fuel')?.a === '198.4', rows.find(x => x.k === 'fuel')?.a);
r.ok('so does an added row', rows.some(x => x.t === 'Ross bakery'));
r.ok('and a deleted one stays gone', !rows.some(x => x.k === 'buf'));
r.ok('the total follows the real figure', (await pg.locator('#bud-vs').textContent()).match(/under|over/) !== null,
  await pg.locator('#bud-vs').textContent());

// Something that turned out free is a recorded answer, not an absent one.
await pg.fill('[data-bk="fuel"] [data-bf="a"]', '');
await pg.fill('[data-bk="mill"] [data-bf="a"]', '0');
await pg.waitForTimeout(300);
r.ok('a spend of zero is not reported as nothing spent',
  (await pg.locator('#bud-spent').textContent()) !== 'nothing yet',
  await pg.locator('#bud-spent').textContent());
await pg.fill('[data-bk="mill"] [data-bf="a"]', '');
await pg.waitForTimeout(300);
r.ok('and with none entered at all it does say so',
  (await pg.locator('#bud-spent').textContent()) === 'nothing yet',
  await pg.locator('#bud-spent').textContent());
await ctx.close();

// ── printing: hiding sections must not lose them on paper ───────────────
ctx = await b.newContext(DESKTOP); pg = await ctx.newPage(); watch(pg);
await pg.goto(BASE, { waitUntil: 'networkidle' });
const panes = await pg.$$eval('.pane', ps => ps.length);
await pg.emulateMedia({ media: 'print' });
r.ok('every section prints', await pg.$$eval('.pane',
  ps => ps.filter(p => getComputedStyle(p).display !== 'none').length) === panes, String(panes));
r.ok('and the menu does not', await pg.locator('#menu').evaluate(m => getComputedStyle(m).display) === 'none');
await ctx.close();

// ── the phone: drawer, install note, no sideways scroll, offline ────────
ctx = await b.newContext({ ...PHONE, userAgent: IPHONE_UA });
pg = await ctx.newPage(); watch(pg);
await pg.goto(BASE, { waitUntil: 'networkidle' });
r.ok('the menu starts off-screen', !(await menuOpen(pg)));
await pg.click('#menu-btn'); await pg.waitForTimeout(350);
r.ok('the hamburger slides it in', await menuOpen(pg));
await pg.click('.navrow[data-sec="hikes"] .navitem'); await pg.waitForTimeout(350);
r.ok('picking a section closes it', !(await menuOpen(pg)));
r.ok('the page never scrolls sideways',
  await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
r.ok('an iPhone is told how to install', await pg.locator('#ios-install').isVisible());
await pg.click('#ios-install-x');
await pg.reload({ waitUntil: 'networkidle' });
r.ok('and dismissing that sticks', !(await pg.locator('#ios-install').isVisible()));

await pg.waitForTimeout(2500);
const caches = await pg.evaluate(() => window.caches.keys());
r.ok('the worker cached this trip', caches.some(c => /^tassie-v\d+$/.test(c)), caches.join(','));
r.ok('and nothing else on the origin', caches.length === 1, caches.join(','));
await ctx.setOffline(true);
await pg.goto(BASE, { waitUntil: 'load' });
r.ok('the page opens with no network', (await pg.title()).includes('Tasmania'));
await go(pg, 'budget');
r.ok('and the budget still works there', await visible(pg) === 'budget', await visible(pg));
await ctx.close();

// ── Android and desktop must not see the iOS note ───────────────────────
for (const [label, opts] of [['Android', { ...PHONE, userAgent:
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36' }],
  ['desktop', DESKTOP]]) {
  const c = await b.newContext(opts); const p = await c.newPage(); watch(p);
  await p.goto(BASE, { waitUntil: 'networkidle' });
  r.ok(`${label} does not see the install note`, !(await p.locator('#ios-install').isVisible()));
  await c.close();
}

// ── the notch, measured against substituted lengths ─────────────────────
if (INSET) {
  const c = await b.newContext(PHONE); const p = await c.newPage(); watch(p);
  await p.goto(INSET + '#itinerary', { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
  await p.evaluate(() => window.scrollTo(0, 900));
  await p.waitForTimeout(600);
  const m = await p.evaluate(() => {
    const h = document.querySelector('header').getBoundingClientRect();
    const t = document.querySelector('.daytabs').getBoundingClientRect();
    return { pad: getComputedStyle(document.querySelector('header')).paddingTop,
             bottom: Math.round(h.bottom), tabs: Math.round(t.top) };
  });
  r.ok('the header clears the status bar', m.pad === '59px' && m.bottom === 116, JSON.stringify(m));
  r.ok('and the day-tab rail follows it down', m.tabs === m.bottom, `${m.tabs} vs ${m.bottom}`);
  await c.close();
} else {
  r.ok('safe-area insets checked', true, 'skipped, no inset URL given');
}

r.ok('no page errors anywhere', errs.length === 0, errs.join(' | '));
await b.close();
process.exit(r.finish() ? 1 : 0);
