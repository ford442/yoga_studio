// Encode procedural masters -> webp / avif / jpg for public/backgrounds.
// Usage: node assets/backgrounds/encode.mjs
import sharp from 'sharp';
import { readdir, mkdir } from 'node:fs/promises';
import { statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MASTERS = path.join(HERE, '_masters');
const OUT = path.resolve(HERE, '../../public/backgrounds');

const FORMATS = [
  ['webp', (img) => img.webp({ quality: 80, effort: 5 })],
  ['avif', (img) => img.avif({ quality: 52, effort: 4 })],
  ['jpg', (img) => img.jpeg({ quality: 82, mozjpeg: true })],
];

const KB = (p) => (statSync(p).size / 1024).toFixed(0);

await mkdir(OUT, { recursive: true });
const files = (await readdir(MASTERS)).filter((f) => f.endsWith('.png'));
let max = 0;
for (const f of files.sort()) {
  const stem = f.replace(/\.png$/, '');
  for (const [ext, apply] of FORMATS) {
    const dst = path.join(OUT, `${stem}.${ext}`);
    await apply(sharp(path.join(MASTERS, f))).toFile(dst);
    const kb = Number(KB(dst));
    max = Math.max(max, kb);
    if (kb > 800) console.warn(`  ! ${stem}.${ext} = ${kb}kB (over 800kB budget)`);
  }
  console.log(`  encoded ${stem}`);
}
console.log(`Done. Largest variant: ${max}kB (budget 800kB).`);
