#!/usr/bin/env node
/**
 * Post-build smoke test for the static export.
 * Verifies that the `out/` directory contains the HTML entry point,
 * PWA manifest, active WGSL shaders, backgrounds, and instructor media.
 */
import { existsSync, readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const OUT_DIR = 'out';

const requiredFiles = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'sacred-monk.wgsl',
  'sacred-lotus-final.wgsl',
  'sacred-lotus-final/core.wgsl',
  'sacred-lotus-final/background-atmosphere.wgsl',
  'sacred-lotus-final/lotus-symbol.wgsl',
  'sacred-lotus-final/energy-ribbons.wgsl',
  'sacred-lotus-final/post-figure-composition.wgsl',
  'sacred-ultra.wgsl',
  'sacred-ultra/core.wgsl',
  'sacred-ultra/background-geometry.wgsl',
  'sacred-ultra/figure-energy.wgsl',
  'sacred-ultra/lotus-ribbons.wgsl',
  'sacred-ultra/post-composition.wgsl',
  'yoga-regular.wgsl',
];

const requiredDirs = ['backgrounds', 'instructor'];

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`✓ ${message}`);
}

async function findAnyFile(dir, predicate) {
  try {
    const entries = await readdir(join(OUT_DIR, dir), { withFileTypes: true });
    return entries.find((entry) => entry.isFile() && predicate(entry.name));
  } catch {
    return undefined;
  }
}

let hasErrors = false;

for (const file of requiredFiles) {
  const path = join(OUT_DIR, file);
  if (existsSync(path)) {
    ok(`found ${file}`);
  } else {
    hasErrors = true;
    console.error(`✗ missing ${file}`);
  }
}

for (const dir of requiredDirs) {
  const path = join(OUT_DIR, dir);
  if (!existsSync(path)) {
    hasErrors = true;
    console.error(`✗ missing ${dir}/ directory`);
    continue;
  }

  const sample = await findAnyFile(dir, (name) =>
    ['.avif', '.webp', '.jpg', '.png', '.mp4', '.webm'].some((ext) => name.endsWith(ext))
  );
  if (sample) {
    ok(`found sample asset in ${dir}/ (${sample.name})`);
  } else {
    hasErrors = true;
    console.error(`✗ no image/media assets found in ${dir}/`);
  }
}

const instructorVideo = await findAnyFile('instructor', (name) => name.endsWith('.mp4') || name.endsWith('.webm'));
if (instructorVideo) {
  ok(`found instructor video (${instructorVideo.name})`);
} else {
  hasErrors = true;
  console.error('✗ no instructor video clips found');
}

const swPath = join(OUT_DIR, 'sw.js');
if (existsSync(swPath)) {
  const swContent = readFileSync(swPath, 'utf-8');
  if (swContent.includes('{{CACHE_VERSION}}')) {
    hasErrors = true;
    console.error('✗ sw.js contains unreplaced CACHE_VERSION placeholder');
  } else {
    const versionMatch = swContent.match(/const CACHE_VERSION = '([^']+)'/);
    ok(`sw.js generated with cache version ${versionMatch?.[1] ?? 'unknown'}`);
  }
}

if (hasErrors) {
  fail('Static export smoke test failed.');
}

console.log('\nStatic export smoke test passed.');
