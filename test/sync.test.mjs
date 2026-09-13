/* The budget, shared between two phones, against the real API.

   Needs the Go API running and a server putting it and the site on one
   origin — test/run.sh does both. What matters here is not that the page
   stores a number but that two devices converge on the same one: a seeded
   default must never outrank an edit made on the other phone, which is
   exactly the bug this spec was written for.

   Usage: node test/sync.test.mjs [baseUrl] [apiUrl] [adminKey] */
import { launch, report, PHONE, budgetRows, go } from './browser.mjs';

const BASE = process.argv[2] || 'http://127.0.0.1:8099/tassie-campervan-2026/';
const API = process.argv[3] || 'http://127.0.0.1:8787';
const ADMIN = process.argv[4] || 'dev-admin-key';
const TRIP = 'tassie-campervan-2026';
const r = report('the budget, between two phones');
const b = await launch();
const errs = [];

// ── phone A, having edited figures before the update landed ─────────────
const a = await b.newContext(PHONE);
const pgA = await a.newPage();
pgA.on('pageerror', e => errs.push('A: ' + e));
await pgA.addInitScript(() => localStorage.setItem('tassie-camper-2026:bud:fuel', '215'));
await pgA.goto(BASE, { waitUntil: 'networkidle' });
let rows = await budgetRows(pgA);
r.ok('the planned rows seed in', rows.length >= 20, String(rows.length));
r.ok('a figure edited before the update survives', rows.find(x => x.k === 'fuel')?.p === '215',
  rows.find(x => x.k === 'fuel')?.p);
r.ok('nothing is marked spent yet', rows.every(x => x.a === ''));

// ── connect it to the trip ──────────────────────────────────────────────
await go(pgA, 'sync');
await pgA.click('#sync-enable');
await pgA.fill('#sync-key', ADMIN);
await pgA.click('#sync-create button[type=submit]');
await pgA.waitForSelector('#sync-on:not(.hidden)', { timeout: 15000 });
const join = await pgA.inputValue('#sync-link');
r.ok('sync connects to the server', join.includes('#join='));
const token = join.split('#join=')[1];

// ── the edits you actually make on a trip ───────────────────────────────
await go(pgA, 'budget');
await pgA.fill('[data-bk="fuel"] [data-bf="a"]', '198.40');
await pgA.fill('[data-badd="food"] input[type=text]', 'Ross bakery vanilla slice');
await pgA.fill('[data-badd="food"] input[type=number]', '12.50');
await pgA.click('[data-badd="food"] button[type=submit]');
await pgA.click('[data-bk="mill"] button[aria-label^="Edit"]');
await pgA.fill('[data-bk="mill"] form input[type=text] >> nth=0', 'Callington Mill — skipped');
await pgA.click('[data-bk="mill"] form button[type=submit]');
await pgA.click('[data-bk="buf"] button[aria-label^="Edit"]');
await pgA.click('[data-bk="buf"] form button:has-text("Delete")');
await pgA.waitForTimeout(2000);

const held = await (await fetch(`${API}/api/v1/trips/${TRIP}`,
  { headers: { Authorization: 'Bearer ' + token } })).json();
const bud = held.lists?.budget || {};
r.ok('the server holds the budget list', Object.keys(bud).length >= 20, String(Object.keys(bud).length));
r.ok('with the real fuel figure', bud.fuel?.v?.a === 198.4, JSON.stringify(bud.fuel?.v?.a));
r.ok('and the deletion as a tombstone', bud.buf?.d === true);

// ── phone B joins, and must not undo any of it ──────────────────────────
const c = await b.newContext(PHONE);
const pgB = await c.newPage();
pgB.on('pageerror', e => errs.push('B: ' + e));
await pgB.goto(join, { waitUntil: 'networkidle' });
await pgB.waitForTimeout(3000);
await go(pgB, 'budget');
const rowsB = await budgetRows(pgB);
r.ok('the other phone sees the added row', rowsB.some(x => x.t === 'Ross bakery vanilla slice'));
r.ok('and the rename', rowsB.find(x => x.k === 'mill')?.t.includes('skipped'));
r.ok('and the deletion', !rowsB.some(x => x.k === 'buf'));
r.ok('and the fuel figure', rowsB.find(x => x.k === 'fuel')?.a === '198.4', rowsB.find(x => x.k === 'fuel')?.a);
r.ok('its own seed did not overwrite the plan', rowsB.find(x => x.k === 'fuel')?.p === '215',
  rowsB.find(x => x.k === 'fuel')?.p);

// ── and back the other way ──────────────────────────────────────────────
await pgB.fill('[data-bk="groc"] [data-bf="a"]', '143.85');
await pgB.waitForTimeout(2000);
await go(pgA, 'sync');
await pgA.click('#sync-now');
await pgA.waitForTimeout(2000);
await go(pgA, 'budget');
rows = await budgetRows(pgA);
r.ok('a figure entered on the other phone comes back', rows.find(x => x.k === 'groc')?.a === '143.85',
  rows.find(x => x.k === 'groc')?.a);

r.ok('no page errors on either phone', errs.length === 0, errs.join(' | '));
await b.close();
process.exit(r.finish() ? 1 : 0);
