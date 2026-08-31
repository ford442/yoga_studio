import { test, expect } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { extname } from 'node:path';

const requiredRootAssets = [
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

function firstFile(dir: string, extensions: string[]): string | undefined {
  try {
    return readdirSync(dir).find((name) => extensions.includes(extname(name).toLowerCase()));
  } catch {
    return undefined;
  }
}

test.describe('static export smoke', () => {
  test('serves required root assets with HTTP 200', async ({ request }) => {
    for (const path of requiredRootAssets) {
      const response = await request.get(path);
      expect(response.ok(), `expected ${path} to return 200, got ${response.status()}`).toBe(true);
    }
  });

  test('serves media assets from backgrounds/ and instructor/', async ({ request }) => {
    const background = firstFile('out/backgrounds', ['.avif', '.webp', '.jpg', '.png']);
    const instructor = firstFile('out/instructor', ['.mp4', '.webm']);

    expect(background, 'no background image found in out/backgrounds').toBeTruthy();
    expect(instructor, 'no instructor video found in out/instructor').toBeTruthy();

    const bgResponse = await request.get(`/backgrounds/${background}`);
    expect(bgResponse.ok()).toBe(true);

    const insResponse = await request.get(`/instructor/${instructor}`);
    expect(insResponse.ok()).toBe(true);
  });
});

test.describe('app loads and controls render', () => {
  test('renders the main UI and toggles begin/pause', async ({ page }) => {
    await page.goto('/');

    // Dismiss welcome panel if it appears.
    const skipOnboarding = page.getByText('Skip onboarding');
    if (await skipOnboarding.isVisible().catch(() => false)) {
      await skipOnboarding.click();
    }

    await expect(page.getByRole('heading', { name: 'SACRED BREATH', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'BEGIN', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '5 MIN' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '10 MIN' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '15 MIN' }).first()).toBeVisible();

    await page.getByRole('button', { name: 'BEGIN', exact: true }).click();
    await expect(page.getByRole('button', { name: 'PAUSE', exact: true })).toBeVisible();
  });

  test('falls back to WebGL2 when WebGPU is unavailable', async ({ browser }) => {
    // Create a context where WebGPU is force-disabled.
    const context = await browser.newContext();
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined });
    });
    const gpuLessPage = await context.newPage();

    await gpuLessPage.goto('/');

    const skipOnboarding = gpuLessPage.getByText('Skip onboarding');
    if (await skipOnboarding.isVisible().catch(() => false)) {
      await skipOnboarding.click();
    }

    await expect(gpuLessPage.getByRole('heading', { name: 'SACRED BREATH', exact: true })).toBeVisible();

    const container = gpuLessPage.locator('[data-renderer]').first();
    await expect(container).toBeVisible();
    await expect(container).toHaveAttribute('data-renderer', 'webgl2');
    await expect(container).toHaveAttribute('data-shader', 'sacred-monk.wgsl');
    await expect(container).toHaveAttribute('data-gpu-failure-stage', '');

    const canvas = gpuLessPage.locator('canvas').first();
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox?.width).toBeGreaterThan(0);
    expect(canvasBox?.height).toBeGreaterThan(0);

    await gpuLessPage.getByRole('button', { name: 'BEGIN', exact: true }).click();
    await expect(gpuLessPage.getByRole('button', { name: 'PAUSE', exact: true })).toBeVisible();

    await context.close();
  });

  test('renders a nonblank static gradient when WebGPU adapter rejection has no WebGL2 fallback', async ({ browser }) => {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'gpu', {
        configurable: true,
        value: {
          requestAdapter: () => Promise.reject(new Error('synthetic adapter rejection')),
          getPreferredCanvasFormat: () => 'bgra8unorm',
        },
      });
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      const callOriginalGetContext = originalGetContext as unknown as (
        this: HTMLCanvasElement,
        kind: string,
        ...args: unknown[]
      ) => RenderingContext | null;
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
        configurable: true,
        value: function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
          if (kind === 'webgl2') return null;
          if (kind === 'webgpu') return {};
          return callOriginalGetContext.call(this, kind, ...args);
        },
      });
    });
    const staticPage = await context.newPage();
    await staticPage.goto('/');
    const skipOnboarding = staticPage.getByText('Skip onboarding');
    if (await skipOnboarding.isVisible().catch(() => false)) await skipOnboarding.click();

    const container = staticPage.locator('[data-renderer]').first();
    await expect(container).toHaveAttribute('data-renderer', 'static');
    const fallbackReason = await container.getAttribute('data-fallback-reason');
    expect(fallbackReason).toBeTruthy();
    const pixels = await container.locator('canvas').first().evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      const c2d = canvas.getContext('2d');
      if (!c2d) return null;
      const center = c2d.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
      const edge = c2d.getImageData(1, 1, 1, 1).data;
      return { width: canvas.width, height: canvas.height, center: [...center], edge: [...edge] };
    });
    expect(pixels?.width).toBeGreaterThan(0);
    expect(pixels?.height).toBeGreaterThan(0);
    expect(pixels?.center[3]).toBe(255);
    expect(pixels?.center.slice(0, 3)).not.toEqual([0, 0, 0]);
    expect(pixels?.center).not.toEqual(pixels?.edge);
    await context.close();
  });

  test('hard-fails to static with a GPU banner when WebGPU adapter rejects', async ({ browser }) => {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'gpu', {
        configurable: true,
        value: {
          requestAdapter: () => Promise.reject(new Error('synthetic adapter rejection')),
          getPreferredCanvasFormat: () => 'bgra8unorm',
        },
      });
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      const callOriginalGetContext = originalGetContext as unknown as (
        this: HTMLCanvasElement,
        kind: string,
        ...args: unknown[]
      ) => RenderingContext | null;
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
        configurable: true,
        value: function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
          if (kind === 'webgpu') {
            return {
              configure() {},
              unconfigure() {},
              getCurrentTexture() { return { createView() { return {}; } }; },
            };
          }
          return callOriginalGetContext.call(this, kind, ...args);
        },
      });
    });
    const failPage = await context.newPage();
    await failPage.goto('/');
    const skipOnboarding = failPage.getByText('Skip onboarding');
    if (await skipOnboarding.isVisible().catch(() => false)) await skipOnboarding.click();

    const container = failPage.locator('[data-renderer]').first();
    await expect(container).toHaveAttribute('data-renderer', 'static');
    await expect(container).toHaveAttribute('data-gpu-failure-stage', 'device');
    const banner = failPage.getByTestId('gpu-error-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute('data-gpu-failure-stage', 'device');
    await expect(banner).toContainText('device');
    const probe = await failPage.evaluate(() => (
      window as unknown as { webgpuProbe?: { ok: boolean; stage: string } }
    ).webgpuProbe);
    expect(probe?.ok).toBe(false);
    expect(probe?.stage).toBe('device');
    await context.close();
  });

  test('does not crash when WebGPU is available', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      errors.push(err.message);
    });

    await page.goto('/');

    const skipOnboarding = page.getByText('Skip onboarding');
    if (await skipOnboarding.isVisible().catch(() => false)) {
      await skipOnboarding.click();
    }

    await page.getByRole('button', { name: 'BEGIN', exact: true }).click();
    await expect(page.getByRole('button', { name: 'PAUSE', exact: true })).toBeVisible();

    // Let a few frames render.
    await page.waitForTimeout(500);

    const container = page.locator('[data-renderer]').first();
    const rendererMode = await container.getAttribute('data-renderer');
    expect(rendererMode === 'webgpu' || rendererMode === 'static').toBe(true);
    expect(rendererMode).not.toBe('webgl2');
    await expect(container).toHaveAttribute('data-shader', 'sacred-monk.wgsl');

    const canvas = page.locator('canvas').first();
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox?.width).toBeGreaterThan(0);
    expect(canvasBox?.height).toBeGreaterThan(0);

    if (rendererMode === 'static') {
      await expect(page.getByTestId('gpu-error-banner')).toBeVisible();
    } else {
      expect(errors).toHaveLength(0);
    }
  });

  test('loads the modular Sacred Integration shader without runtime errors', async ({ page }) => {
    const errors: string[] = [];
    const loadedModules = new Map<string, number>();
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      const path = new URL(response.url()).pathname;
      const match = path.match(/\/sacred-ultra\/([^/]+\.wgsl)$/);
      if (match) loadedModules.set(match[1], response.status());
    });

    await page.goto('/');
    const skipOnboarding = page.getByText('Skip onboarding');
    if (await skipOnboarding.isVisible().catch(() => false)) await skipOnboarding.click();
    await page.getByRole('button', { name: 'BROWSE TECHNIQUES' }).click();
    await page.getByRole('button', { name: /Sacred Integration/ }).click();

    const container = page.locator('[data-renderer]').first();
    await expect(container).toHaveAttribute('data-shader', 'sacred-ultra.wgsl');
    await page.waitForTimeout(750);
    const renderer = await container.getAttribute('data-renderer');
    expect(renderer === 'webgpu' || renderer === 'static').toBe(true);
    expect(renderer).not.toBe('webgl2');
    if (renderer === 'webgpu') {
      await expect.poll(() => loadedModules.size).toBe(5);
      expect([...loadedModules.values()]).toEqual([200, 200, 200, 200, 200]);
      expect(errors).toHaveLength(0);
    } else {
      await expect(page.getByTestId('gpu-error-banner')).toBeVisible();
    }

    const canvasBox = await container.locator('canvas').first().boundingBox();
    expect(canvasBox?.width).toBeGreaterThan(0);
    expect(canvasBox?.height).toBeGreaterThan(0);
  });

  test('loads the modular Sacred Lotus shader without runtime errors', async ({ page }) => {
    const errors: string[] = [];
    const loadedModules = new Map<string, number>();
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      const path = new URL(response.url()).pathname;
      const match = path.match(/\/sacred-lotus-final\/([^/]+\.wgsl)$/);
      if (match) loadedModules.set(match[1], response.status());
    });

    await page.goto('/');
    const skipOnboarding = page.getByText('Skip onboarding');
    if (await skipOnboarding.isVisible().catch(() => false)) await skipOnboarding.click();
    await page.getByRole('button', { name: 'BROWSE TECHNIQUES' }).click();
    await page.getByRole('button', { name: /Alternate Nostril Foundation/ }).click();

    const container = page.locator('[data-renderer]').first();
    await expect(container).toHaveAttribute('data-shader', 'sacred-lotus-final.wgsl');
    await page.waitForTimeout(750);
    const renderer = await container.getAttribute('data-renderer');
    expect(renderer === 'webgpu' || renderer === 'static').toBe(true);
    expect(renderer).not.toBe('webgl2');
    if (renderer === 'webgpu') {
      await expect.poll(() => loadedModules.size).toBe(5);
      expect([...loadedModules.values()]).toEqual([200, 200, 200, 200, 200]);
      expect(errors).toHaveLength(0);
    } else {
      await expect(page.getByTestId('gpu-error-banner')).toBeVisible();
    }

    const canvasBox = await container.locator('canvas').first().boundingBox();
    expect(canvasBox?.width).toBeGreaterThan(0);
    expect(canvasBox?.height).toBeGreaterThan(0);
  });

  test('keeps an active renderer nonblank through repeated viewport shape changes', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto('/');
    const skipOnboarding = page.getByText('Skip onboarding');
    if (await skipOnboarding.isVisible().catch(() => false)) await skipOnboarding.click();
    await page.getByRole('button', { name: 'BEGIN', exact: true }).click();

    for (const viewport of [{ width: 960, height: 540 }, { width: 540, height: 960 }, { width: 1100, height: 620 }]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(350);
      const rendererCanvas = page.locator('[data-renderer] canvas').first();
      const backingSize = await rendererCanvas.evaluate((element) => {
        const canvas = element as HTMLCanvasElement;
        return { width: canvas.width, height: canvas.height };
      });
      const screenshot = await rendererCanvas.screenshot();
      const energy = await page.evaluate(async (dataUrl) => {
        const source = new Image();
        source.src = dataUrl;
        await source.decode();
        const probe = document.createElement('canvas');
        probe.width = 8;
        probe.height = 8;
        const c2d = probe.getContext('2d');
        if (!c2d) return 0;
        c2d.drawImage(source, 0, 0, 8, 8);
        const data = c2d.getImageData(0, 0, 8, 8).data;
        let energy = 0;
        for (let i = 0; i < data.length; i += 4) energy += data[i] + data[i + 1] + data[i + 2];
        return energy;
      }, `data:image/png;base64,${screenshot.toString('base64')}`);
      expect(backingSize.width).toBeGreaterThan(0);
      expect(backingSize.height).toBeGreaterThan(0);
      expect(energy).toBeGreaterThan(0);
    }
    const renderer = await page.locator('[data-renderer]').first().getAttribute('data-renderer');
    if (renderer === 'webgpu') expect(errors).toHaveLength(0);
  });

  test('clears prior session ledger and does not restore practice history', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
        configurable: true,
        value: () => null,
      });
      const date = new Date().toISOString().slice(0, 10);
      localStorage.setItem('sacred-breath-session-ledger', JSON.stringify({
        version: 1,
        legacyBaseline: { todayMinutes: 2, todayBreaths: 3, currentStreak: 4, lastPracticeDate: date },
        sessions: [{
          endedAt: `${date}T08:00:00.000Z`,
          durationSec: 300,
          breaths: 12,
          modeId: 'ujjayi',
          techniqueId: 'ujjayi',
          settings: { inhale: 4, hold1: 2, exhale: 6, hold2: 2 },
        }],
      }));
    });
    await page.goto('/');

    const skipOnboarding = page.getByText('Skip onboarding');
    if (await skipOnboarding.isVisible().catch(() => false)) await skipOnboarding.click();

    // Persistence is disabled — seeded history must be wiped and stats stay at zero.
    await expect.poll(async () =>
      page.evaluate(() => localStorage.getItem('sacred-breath-session-ledger')),
    ).toBeNull();

    const stats = page.getByRole('button', { name: 'Open practice trends' });
    await expect(stats).toContainText('0');
    await stats.click();
    await expect(page.getByRole('dialog', { name: 'Practice trends' })).toBeVisible();
    await expect(page.locator('[data-date]')).toHaveCount(28);
    await page.getByRole('button', { name: 'Close practice trends' }).click();

    await page.getByRole('button', { name: 'Open settings' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'EXPORT JSON' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^sacred-breath-history-\d{4}-\d{2}-\d{2}\.json$/);
  });
});
