#!/usr/bin/env node
/*
 * Turn one SVG into the four PNGs a trip page needs.
 *
 *   node make-icons.mjs <icon.svg> <out-dir> [background-hex]
 *
 * Writes icon-192.png, icon-512.png, icon-maskable-512.png and
 * apple-touch-icon.png (180). All four are flattened onto the background —
 * the template's icons have no alpha channel, iOS renders transparency badly,
 * and a launcher that composites its own backdrop looks wrong either way.
 *
 * The maskable one is drawn at 80% and centred, because Android crops
 * maskable icons to a circle and anything outside that inner disc is lost.
 * Draw the source mark simply: flat shapes, strong contrast, no text below
 * about 40 px, and nothing meaningful in the outer 10%.
 */

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , src, outDir, bgArg] = process.argv;
if (!src || !outDir) {
  console.error('usage: make-icons.mjs <icon.svg> <out-dir> [background-hex]');
  process.exit(2);
}
const bg = bgArg || '#0f3d2e';
if (!/^#[0-9a-fA-F]{6}$/.test(bg)) {
  console.error(`background must be a #rrggbb hex colour, got ${bg}`);
  process.exit(2);
}

// sharp is not a dependency of this repository; it arrives with wrangler under
// server/node_modules. Look there before giving up, so the common case needs
// no install.
async function loadSharp() {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    'sharp',
    resolve(here, '../../../../server/node_modules/sharp'),
  ];
  for (const c of candidates) {
    try {
      const require = createRequire(import.meta.url);
      return require(c);
    } catch { /* try the next one */ }
  }
  console.error(
    'sharp not found. Install it just for this run:\n' +
    '  npm i --no-save --prefix /tmp/icons sharp\n' +
    '  NODE_PATH=/tmp/icons/node_modules node make-icons.mjs …');
  process.exit(1);
}

const sharp = await loadSharp();
mkdirSync(outDir, { recursive: true });

const rgb = {
  r: parseInt(bg.slice(1, 3), 16),
  g: parseInt(bg.slice(3, 5), 16),
  b: parseInt(bg.slice(5, 7), 16),
};

const flat = (size) =>
  sharp(src, { density: 512 }).resize(size, size, { fit: 'contain', background: rgb })
    .flatten({ background: rgb }).png();

const written = [];

for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  await flat(size).toFile(join(outDir, name));
  written.push(name);
}

// Maskable: the mark at 80%, centred on a full-bleed background.
const inner = Math.round(512 * 0.8);
const mark = await sharp(src, { density: 512 })
  .resize(inner, inner, { fit: 'contain', background: { ...rgb, alpha: 0 } })
  .png().toBuffer();
// composite() runs after flatten() in sharp's pipeline, so the alpha the
// centred mark brings with it is dropped in a second pass.
const masked = await sharp({ create: { width: 512, height: 512, channels: 3, background: rgb } })
  .composite([{ input: mark, gravity: 'centre' }])
  .png().toBuffer();
await sharp(masked).flatten({ background: rgb }).png()
  .toFile(join(outDir, 'icon-maskable-512.png'));
written.push('icon-maskable-512.png');

console.log(`wrote ${written.join(', ')} to ${outDir} on ${bg}`);
