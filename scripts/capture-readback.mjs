#!/usr/bin/env node
/**
 * Capture a WebGPU frame by GPU readback (not a screenshot) and optionally
 * compare it with an earlier capture.
 *
 *   node scripts/capture-readback.mjs <url> <out.json> [--compare base.json] [--time 3.25] [--query gpu_shader=sacred-ultra.wgsl]
 *     [--png out.png] [--field '{"particleLevel":2,"hdrEnabled":true,"bloomLevels":5}'] [--frames N]
 *
 * <url> is a served build (e.g. http://localhost:3001/); `?gpu_readback` is
 * appended. Headless Chrome only exposes a WebGPU adapter with the SwiftShader
 * flags below. Exit code 1 when --compare finds differing pixels.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const [, value] = args.splice(i, 2);
  return value;
};
const compare = flag('--compare');
const time = Number(flag('--time') ?? '3.25');
const extraQuery = flag('--query') ?? '';
const pngOut = flag('--png');
const fieldOverride = flag('--field');
const frames = Number(flag('--frames') ?? '1');
const [url, out] = args;
if (!url || !out) {
  console.error('usage: capture-readback.mjs <url> <out.json> [--compare base.json] [--time s] [--query k=v&...]');
  process.exit(2);
}

const browser = await chromium.launch({
  channel: 'chromium',
  args: [
    '--enable-unsafe-webgpu',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--use-vulkan=swiftshader',
    '--enable-features=Vulkan,UseSkiaRenderer',
    '--disable-vulkan-surface',
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: 480, height: 270 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  // Quality mode keeps the geometry overlay on; skip onboarding noise.
  await page.addInitScript((renderer) => {
    try { localStorage.setItem('sacred-breath-renderer', renderer); } catch { /* ignore */ }
  }, process.env.READBACK_RENDERER_SETTINGS ?? JSON.stringify({ performanceMode: 'quality' }));
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') console.log(`[page ${msg.type()}] ${msg.text()}`);
  });
  const target = new URL(url);
  target.searchParams.set('gpu_readback', '');
  for (const [k, v] of new URLSearchParams(extraQuery)) target.searchParams.set(k, v);
  await page.goto(target.toString());
  await page.waitForFunction(() => typeof window.__sacredBreathReadback === 'function', null, { timeout: 60_000 });
  // Let the governor settle and the shader pipelines finish compiling.
  await page.waitForTimeout(Number(process.env.READBACK_SETTLE_MS ?? 4000));
  const attrs = await page.evaluate(() => {
    const el = document.querySelector('[data-renderer]');
    return el
      ? {
          renderer: el.getAttribute('data-renderer'),
          overlay: el.getAttribute('data-overlay'),
          quality: el.getAttribute('data-quality'),
          field: el.getAttribute('data-breath-field'),
        }
      : null;
  });
  console.log('canvas attrs', JSON.stringify(attrs));
  const field = fieldOverride ? JSON.parse(fieldOverride) : undefined;
  // With --frames N, capture N consecutive frames (the sim advances between them) and keep the last.
  let result;
  for (let i = 0; i < frames; i += 1) {
    result = await page.evaluate(
      ([t, f]) => window.__sacredBreathReadback({ time: t, overlay: true, ...(f ? { field: f } : {}) }),
      [time + i / 60, field],
    );
  }
  if (pngOut) {
    const dataUrl = await page.evaluate((r) => {
      const bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
      if (r.format.startsWith('bgra')) {
        for (let i = 0; i < bytes.length; i += 4) {
          const b = bytes[i];
          bytes[i] = bytes[i + 2];
          bytes[i + 2] = b;
        }
      }
      for (let i = 3; i < bytes.length; i += 4) bytes[i] = 255;
      const canvas = document.createElement('canvas');
      canvas.width = r.width;
      canvas.height = r.height;
      canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(bytes.buffer), r.width, r.height), 0, 0);
      return canvas.toDataURL('image/png');
    }, result);
    writeFileSync(pngOut, Buffer.from(dataUrl.split(',')[1], 'base64'));
  }
  writeFileSync(out, JSON.stringify(result));
  const bytes = Buffer.from(result.base64, 'base64');
  let sum = 0;
  for (const b of bytes) sum += b;
  console.log(`captured ${result.width}x${result.height} ${result.format} passes=[${result.passes.join(', ')}] mean=${(sum / bytes.length).toFixed(3)}`);

  if (compare) {
    const base = JSON.parse(readFileSync(compare, 'utf-8'));
    if (base.width !== result.width || base.height !== result.height) {
      console.error(`size differs: ${base.width}x${base.height} vs ${result.width}x${result.height}`);
      process.exit(1);
    }
    const a = Buffer.from(base.base64, 'base64');
    let diffPixels = 0;
    let maxDelta = 0;
    for (let i = 0; i < a.length; i += 4) {
      let pixelDiff = false;
      for (let c = 0; c < 4; c += 1) {
        const d = Math.abs(a[i + c] - bytes[i + c]);
        if (d > 0) pixelDiff = true;
        if (d > maxDelta) maxDelta = d;
      }
      if (pixelDiff) diffPixels += 1;
    }
    console.log(`compare vs ${compare}: ${diffPixels} differing pixels, max channel delta ${maxDelta}`);
    if (diffPixels > 0) process.exit(1);
  }
} finally {
  await browser.close();
}
