#!/usr/bin/env node
/**
 * Post-build HTTP smoke test for the static export.
 * Serves `out/` on a temporary port and verifies that required assets
 * (HTML entry point, PWA manifest, active shaders, and sample media)
 * are reachable with HTTP 200.
 */
import { existsSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { extname } from 'node:path';

const OUT_DIR = 'out';
const PORT = 3456;
const BASE_URL = `http://localhost:${PORT}`;

const requiredPaths = [
  '/',
  '/manifest.webmanifest',
  '/sacred-monk.wgsl',
  '/sacred-lotus-final.wgsl',
  '/sacred-lotus-final/core.wgsl',
  '/sacred-lotus-final/background-atmosphere.wgsl',
  '/sacred-lotus-final/lotus-symbol.wgsl',
  '/sacred-lotus-final/energy-ribbons.wgsl',
  '/sacred-lotus-final/post-figure-composition.wgsl',
  '/sacred-ultra.wgsl',
  '/sacred-ultra/core.wgsl',
  '/sacred-ultra/background-geometry.wgsl',
  '/sacred-ultra/figure-energy.wgsl',
  '/sacred-ultra/lotus-ribbons.wgsl',
  '/sacred-ultra/post-composition.wgsl',
  '/yoga-regular.wgsl',
];

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`✓ ${message}`);
}

async function fetchStatus(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  return { path, ok: response.ok, status: response.status };
}

async function waitForServer(url, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Static server did not become ready in time');
}

function firstFile(dir, extensions) {
  try {
    return readdirSync(dir).find((name) => extensions.includes(extname(name).toLowerCase()));
  } catch {
    return undefined;
  }
}

if (!existsSync(OUT_DIR)) {
  fail(`Missing ${OUT_DIR}/ directory. Run \`npm run build\` first.`);
}

const server = spawn('npx', ['serve@latest', OUT_DIR, '-l', String(PORT)], {
  stdio: 'ignore',
  shell: false,
});

let hasErrors = false;

try {
  await waitForServer(`${BASE_URL}/`);

  for (const path of requiredPaths) {
    const { ok: isOk, status } = await fetchStatus(path);
    if (isOk) {
      ok(`${path} returned 200`);
    } else {
      hasErrors = true;
      console.error(`✗ ${path} returned ${status}`);
    }
  }

  const background = firstFile(`${OUT_DIR}/backgrounds`, ['.avif', '.webp', '.jpg', '.png']);
  if (background) {
    const { ok: isOk, status } = await fetchStatus(`/backgrounds/${background}`);
    if (isOk) {
      ok(`sample background asset returned 200 (${background})`);
    } else {
      hasErrors = true;
      console.error(`✗ background asset returned ${status}`);
    }
  } else {
    hasErrors = true;
    console.error('✗ no background image found in out/backgrounds');
  }

  const instructor = firstFile(`${OUT_DIR}/instructor`, ['.mp4', '.webm']);
  if (instructor) {
    const { ok: isOk, status } = await fetchStatus(`/instructor/${instructor}`);
    if (isOk) {
      ok(`sample instructor video returned 200 (${instructor})`);
    } else {
      hasErrors = true;
      console.error(`✗ instructor video returned ${status}`);
    }
  } else {
    hasErrors = true;
    console.error('✗ no instructor video found in out/instructor');
  }
} catch (err) {
  hasErrors = true;
  console.error(`✗ ${err.message}`);
} finally {
  server.kill('SIGTERM');
}

if (hasErrors) {
  fail('Static export HTTP smoke test failed.');
}

console.log('\nStatic export HTTP smoke test passed.');
