/* The update a phone already holding the trip will actually make.

   A fresh install proves nothing about the people carrying the page: they
   have a worker serving an older cache, ticks in localStorage and figures
   they have edited. This walks that path — old version installed, new one
   deployed underneath, update bar tapped — and checks that nothing they
   did survives only by luck.

   run.sh serves the previous released version on one port and the working
   tree on another, and swaps the first for the second mid-test.

   Usage: node test/upgrade.test.mjs <oldUrl> <oldRoot> <newRoot> */
import { launch, report, PHONE, budgetRows, go, openMenu } from './browser.mjs';
import { execSync } from 'child_process';

const BASE = process.argv[2];
const OLD_ROOT = process.argv[3];
const NEW_ROOT = process.argv[4];
if (!BASE || !OLD_ROOT || !NEW_ROOT) {
  console.error('usage: node test/upgrade.test.mjs <oldUrl> <oldRoot> <newRoot>');
  process.exit(2);
}
const NS = 'tassie-camper-2026:';
const r = report('upgrading a phone that already has the trip');
const b = await launch();
const ctx = await b.newContext(PHONE);
const pg = await ctx.newPage();
const errs = [];
pg.on('pageerror', e => errs.push(String(e)));

const version = async () => (await pg.evaluate(() => caches.keys()))
  .filter(k => /^tassie-v\d+$/.test(k)).sort().join(',');

// ── living on the released version ──────────────────────────────────────
await pg.goto(BASE, { waitUntil: 'networkidle' });
await pg.waitForTimeout(2500);
const before = await version();
r.ok('starts on the released version', before !== '', before);

await go(pg, 'checklists');
const box = pg.locator('#checklists .chk').first();
const key = await box.getAttribute('data-k');
await box.check();
await openMenu(pg);
await pg.click('.navrow[data-sec="hikes"] .pin');
await go(pg, 'budget');
// Whichever shape the old budget had, put a figure into the first field.
const field = (await pg.$('[data-bk="fuel"] [data-bf="p"]')) || (await pg.$('[data-b="fuel"]'));
await field.fill('215');
await pg.waitForTimeout(800);

// ── the deploy lands underneath it ──────────────────────────────────────
execSync(`rm -rf "${OLD_ROOT}/tassie-campervan-2026" && cp -r "${NEW_ROOT}/tassie-campervan-2026" "${OLD_ROOT}/"`);
await pg.reload({ waitUntil: 'networkidle' });
const bar = pg.locator('button', { hasText: 'A newer plan is ready' });
await bar.waitFor({ timeout: 20000 }).catch(() => {});
r.ok('the update bar appears', await bar.isVisible().catch(() => false));
await bar.click();
await pg.waitForFunction(v => caches.keys().then(k =>
  k.some(x => /^tassie-v\d+$/.test(x) && x !== v)), before, { timeout: 20000 }).catch(() => {});
await pg.waitForTimeout(2500);
const after = await version();
r.ok('it swaps to the new version', after !== before, `${before} -> ${after}`);
r.ok('and sweeps the old cache away', !after.split(',').includes(before), after);

// ── nothing they did may be lost ────────────────────────────────────────
r.ok('the tick survived',
  await pg.evaluate(([n, k]) => localStorage.getItem(n + 'chk:' + k) === '1', [NS, key]));
r.ok('the starred section survived',
  await pg.evaluate(n => localStorage.getItem(n + 'home') === 'hikes', NS));
await go(pg, 'budget');
const rows = await budgetRows(pg);
r.ok('the budget carries every row', rows.length >= 20, String(rows.length));
r.ok('including the figure they edited', rows.find(x => x.k === 'fuel')?.p === '215',
  rows.find(x => x.k === 'fuel')?.p);
r.ok('untouched rows keep the plan', rows.find(x => x.k === 'van')?.p === '747.25',
  rows.find(x => x.k === 'van')?.p);

// ── and it still works with no signal ───────────────────────────────────
await pg.fill('[data-bk="fuel"] [data-bf="a"]', '198.40');
await ctx.setOffline(true);
await pg.reload({ waitUntil: 'load' });
r.ok('opens offline after the update', (await pg.title()).includes('Tasmania'));
await go(pg, 'budget');
r.ok('and the figure entered offline is still there',
  await pg.inputValue('[data-bk="fuel"] [data-bf="a"]') === '198.4');

r.ok('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
process.exit(r.finish() ? 1 : 0);
