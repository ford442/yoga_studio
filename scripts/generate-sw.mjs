#!/usr/bin/env node
/**
 * Generate public/sw.js from scripts/sw.template.js, injecting a build-specific
 * cache version so every deploy invalidates old caches.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const TEMPLATE_PATH = join(ROOT, 'scripts', 'sw.template.js');
const OUTPUT_PATH = join(ROOT, 'public', 'sw.js');
const PUBLIC_DIR = join(ROOT, 'public');

const packageJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
const version = packageJson.version ?? '0.1.0';
const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
const cacheVersion = `${version}-${timestamp}`;

const template = readFileSync(TEMPLATE_PATH, 'utf-8');
const generated = template.replace(/'\{\{CACHE_VERSION\}\}'/g, `'${cacheVersion}'`);

if (generated.includes('{{CACHE_VERSION}}')) {
  console.error('SW generation failed: CACHE_VERSION placeholder was not replaced.');
  process.exit(1);
}

writeFileSync(OUTPUT_PATH, generated, 'utf-8');

// Sanity-check precache asset existence.
const precacheMatch = generated.match(/const PRECACHE_ASSETS = ([\s\S]*?);/);
if (precacheMatch) {
  const urls = precacheMatch[1]
    .match(/'([^']+)'/g)
    ?.map((m) => m.slice(1, -1))
    .filter((url) => url.startsWith('./'));

  const optional = new Set([
    './backgrounds/void-nearblack-16x9.webp',
    './instructor/inhale-raise-01.mp4',
  ]);

  for (const url of urls ?? []) {
    // index.html and favicon.ico are build outputs, not public/ assets.
    if (url === './index.html' || url === './favicon.ico') continue;

    const relative = url.replace(/^\.\//, '');
    const exists = existsSync(join(PUBLIC_DIR, relative));
    if (!exists) {
      const level = optional.has(url) ? 'warn' : 'error';
      console[level](`SW precache asset missing: public/${relative}`);
    }
  }
}

console.log(`Generated public/sw.js with cache version ${cacheVersion}`);
