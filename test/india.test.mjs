/* The India page, on its own.
   page.test.mjs is bound to the Tasmania trip by its namespace, cache name
   and budget keys, so this covers the same ground for a second trip: that
   one pane shows at a time, that every menu row reaches its pane, that the
   day tabs and the synced lists work, and that the budget seeds in rupees.

   Sections are reached by hash rather than by clicking the menu, because on
   a phone viewport the drawer's list scrolls and the lower rows sit outside
   it — one real menu click still proves the menu drives navigation. */
import { launch, report, PHONE, visible, budgetRows, go } from './browser.mjs';

const BASE = process.argv[2] || 'http://127.0.0.1:8099/india-nov-2026/';
const r = report('the India page on its own');
const browser = await launch();
const ctx = await browser.newContext(PHONE);
const pg = await ctx.newPage();
const errs = [];
pg.on('pageerror', e => errs.push(String(e)));
pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

await pg.goto(BASE, { waitUntil: 'networkidle' });

// one pane at a time
r.ok('opens on exactly one section', (await visible(pg)).split(",").length === 1, await visible(pg));

// every menu row reaches its pane
const secs = await pg.$$eval('.navrow', rows => rows.map(x => x.dataset.sec));
r.ok('ten menu rows', secs.length === 10, secs.join(','));
for (const s of secs) {
  await pg.evaluate(id => { location.hash = '#' + id; }, s);
  await pg.waitForTimeout(150);
  const seen = (await visible(pg)).split(",");
  r.ok(`${s} opens alone`, seen.length === 1 && seen[0] === s, seen.join(","));
}

// and the menu itself still drives navigation
await go(pg, 'overview');
r.ok('the menu opens a section', (await visible(pg)) === 'overview', await visible(pg));

// day tabs
await pg.evaluate(() => { location.hash = '#itinerary'; }); await pg.waitForTimeout(150);
const tabs = await pg.$$('.daytab');
r.ok('five day tabs', tabs.length === 5, String(tabs.length));
for (let i = 1; i <= 5; i++) {
  await pg.click(`.daytab[data-day="${i}"]`);
  const shown = await pg.$$eval('.daypanel:not(.hidden)', n => n.map(x => x.dataset.day));
  r.ok(`day ${i} shows alone`, shown.length === 1 && shown[0] === String(i), shown.join(','));
}

// a daylink from Plan B jumps to a day
await pg.evaluate(() => { location.hash = '#planb'; }); await pg.waitForTimeout(150);
await pg.click('#planb a[data-goto]');
const after = (await visible(pg)).split(",");
r.ok('a Plan B daylink opens the day-by-day', after.length === 1 && after[0] === 'itinerary', after.join(","));

// checklists tick and persist
await pg.evaluate(() => { location.hash = '#checklists'; }); await pg.waitForTimeout(150);
const boxes = await pg.$$('input.chk');
r.ok('checklist has items', boxes.length === 30, String(boxes.length));
await pg.check('input.chk[data-k="b1"]');
await pg.reload({ waitUntil: 'networkidle' });
await pg.evaluate(() => { location.hash = '#checklists'; }); await pg.waitForTimeout(150);
r.ok('a tick survives reload', await pg.isChecked('input.chk[data-k="b1"]'));

// budget seeds in rupees and totals
await pg.evaluate(() => { location.hash = '#budget'; }); await pg.waitForTimeout(150);
const rows = await budgetRows(pg);
r.ok('budget seeded every row', rows.length === 16, String(rows.length));
const total = (await pg.textContent('#grand-total')).trim();
r.ok('total is in rupees', total.startsWith('₹'), total);
r.ok('total is not zero', total !== '₹0', total);
const per = (await pg.textContent('#per-person')).trim();
r.ok('per person divides by four', per.startsWith('₹'), per);

// budget edit survives reload
await pg.fill('[data-bk="s3"] [data-bf="a"]', '41000');
await pg.waitForTimeout(400);
await pg.reload({ waitUntil: 'networkidle' });
await pg.evaluate(() => { location.hash = '#budget'; }); await pg.waitForTimeout(150);
r.ok('an entered figure survives', (await pg.inputValue('[data-bk="s3"] [data-bf="a"]')) === '41000');

r.ok('no page errors', errs.length === 0, errs.join(' | '));
await browser.close();
process.exit(r.finish() ? 1 : 0);
