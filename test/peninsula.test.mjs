/* The Friday chooser: a map, a road graph and a running clock, all client
   side. What matters is that the arithmetic is right, that the clock warns
   without ever removing an option, and that a place ruled out by the hire
   terms is shown and flagged rather than quietly dropped.

   Usage: node test/peninsula.test.mjs [baseUrl] */
import { launch, report, PHONE } from './browser.mjs';
const B = process.argv[2] || 'http://127.0.0.1:8099/tassie-campervan-2026/';
const r = report('the peninsula chooser');
const b = await launch();
const ctx = await b.newContext({ ...PHONE, viewport:{width:390,height:2600}, deviceScaleFactor:2 });
const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', e => errs.push(String(e)));
await pg.goto(B + '#peninsula', { waitUntil: 'networkidle' });

r.ok('the section opens', await pg.locator('#peninsula').isVisible());
r.ok('the closure warning is up front', (await pg.locator('#peninsula').textContent()).includes('closed today'));
const pins = await pg.$$eval('#pen-map .pen-pin', g => g.length);
r.ok('the map draws every pin', pins === 28, String(pins));
r.ok('options are listed', (await pg.locator('#pen-count').textContent()).includes('places'));
r.ok('starts at the hotel', (await pg.locator('#pen-here').textContent()).includes('ibis'));
r.ok('clock starts at 08:30', (await pg.locator('#pen-clock').textContent()) === '08:30');

// nearest from the hotel should be Sorell, and the list is sorted by drive time
const firstRow = await pg.$$eval('#pen-next > div', ds => ds.slice(0,3).map(d => d.querySelector('.text-sm.font-medium').textContent));
r.ok('nearest first from the hotel', firstRow[0] === 'Sorell', firstRow.join(' | '));

// pick a few stops and watch the clock advance
await pg.click('#pen-next > div:has-text("Pirates Bay Lookout") button');
await pg.waitForTimeout(200);
r.ok('choosing a stop moves you there', (await pg.locator('#pen-here').textContent()).includes('Pirates Bay'));
const clockAfter = await pg.locator('#pen-clock').textContent();
r.ok('the clock advanced past 08:30', clockAfter > '08:30', clockAfter);
const nearNow = await pg.$$eval('#pen-next > div', ds => ds[0].querySelector('.text-sm.font-medium').textContent);
r.ok('options re-sort from where you now are', nearNow === 'Tessellated Pavement', nearNow);

await pg.click('#pen-next > div:has-text("Port Arthur Historic Site") button');
await pg.waitForTimeout(200);
const home1 = await pg.locator('#pen-home').textContent();
r.ok('it projects a time home', /^\d\d:\d\d/.test(home1), home1);

// overrun should warn, not remove options
await pg.click('#pen-next > div:has-text("Coal Mines") button');
await pg.click('#pen-next > div:has-text("Tasmanian Devil Unzoo") button');
await pg.waitForTimeout(200);
const home2 = await pg.locator('#pen-home').textContent();
r.ok('it warns when the day overruns', home2.includes('over'), home2);
r.ok('and still offers every option', (await pg.$$eval('#pen-next > div', d => d.length)) > 20);

// the plan survives a reload
const planBefore = await pg.$$eval('#pen-plan > div', d => d.length);
await pg.reload({ waitUntil: 'networkidle' });
await pg.goto(B + '#peninsula', { waitUntil: 'networkidle' });
r.ok('the plan survives a reload', (await pg.$$eval('#pen-plan > div', d => d.length)) === planBefore);

// tag filter
await pg.click('#pen-tags button:has-text("beach")');
await pg.waitForTimeout(200);
const beachOnly = await pg.$$eval('#pen-next > div', ds => ds.map(d => d.querySelector('.text-sm.font-medium').textContent));
r.ok('the tag filter narrows the list', beachOnly.length >= 3 && beachOnly.length <= 6, beachOnly.join(' | '));
await pg.click('#pen-tags button:has-text("beach")');
await pg.waitForTimeout(200);

// ruled-out places are present but flagged
const txt = await pg.locator('#pen-next').textContent();
r.ok('Cape Hauy is shown, not hidden', txt.includes('Cape Hauy'));
r.ok('and flagged as gravel', txt.includes('gravel'));
r.ok('Tasman Arch is shown and flagged closed', txt.includes('Tasman Arch') && txt.includes('closed today'));

await pg.click('#pen-reset');
await pg.waitForTimeout(200);
r.ok('start again clears the plan', (await pg.locator('#pen-clock').textContent()) === '08:30');

r.ok('no page errors', errs.length === 0, errs.join(' | '));
await b.close();
process.exit(r.finish() ? 1 : 0);
