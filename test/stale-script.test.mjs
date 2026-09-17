/* A phone whose old worker is still in charge, reloading without tapping the
   update bar.

   Navigations are network-first and assets were cache-first, so that reload
   used to hand the new index.html an old app.js: the new sections rendered
   as empty boxes with no error anywhere. It shipped, and it took a photo
   from the road to find. app.js and app.css are network-first now, and the
   page asks for app.js?v=N so an old cache cannot answer.

   Usage: node test/stale-script.test.mjs <oldUrl> <oldRoot> <newRoot> */
import { launch, report, PHONE } from './browser.mjs';
import { execSync } from 'child_process';

const B = process.argv[2], OLD = process.argv[3], NEW = process.argv[4];
if (!B || !OLD || !NEW) { console.error('usage: node test/stale-script.test.mjs <oldUrl> <oldRoot> <newRoot>'); process.exit(2); }
const r = report('a reload that skips the update bar');
const b = await launch();
const ctx = await b.newContext(PHONE);
const pg = await ctx.newPage();

const errs = [];
pg.on('pageerror', e => errs.push(String(e)));

await pg.goto(B, { waitUntil: 'networkidle' });
await pg.waitForTimeout(2500);
r.ok('the released version installs', (await pg.evaluate(() => caches.keys())).length > 0);

execSync(`rm -rf "${OLD}/tassie-campervan-2026" && cp -r "${NEW}/tassie-campervan-2026" "${OLD}/"`);

// Reload, and deliberately do not tap the update bar.
await pg.reload({ waitUntil: 'networkidle' });
await pg.waitForTimeout(2000);
const got = await pg.evaluate(() => ({
  markup: !!document.getElementById('pen-next'),
  script: document.querySelectorAll('#pen-tags button').length > 0,
}));
r.ok('the new markup arrives', got.markup);
r.ok('and the script that matches it runs', got.script,
     got.markup && !got.script ? 'new markup, old script — the bug' : '');
r.ok('no page errors', errs.length === 0, errs.join(' | '));

// And it must still work with no network at all.
await ctx.setOffline(true);
await pg.reload({ waitUntil: 'load' });
r.ok('still opens offline', (await pg.title()).includes('Tasmania'));
r.ok('with its script', await pg.evaluate(() => document.querySelectorAll('#pen-tags button').length > 0));
await b.close();
process.exit(r.finish() ? 1 : 0);
