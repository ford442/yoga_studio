import { test, expect } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { extname } from 'node:path';

const requiredRootAssets = [
  '/',
  '/manifest.webmanifest',
  '/sacred-monk.wgsl',
  '/sacred-lotus-final.wgsl',
  '/sacred-ultra.wgsl',
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
      // @ts-expect-error deleting an experimental API for fallback testing
      delete (window as typeof window & { navigator: Navigator }).navigator.gpu;
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

    const fallbackReason = await container.getAttribute('data-fallback-reason');
    expect(fallbackReason).toBeTruthy();

    const canvas = gpuLessPage.locator('canvas').first();
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox?.width).toBeGreaterThan(0);
    expect(canvasBox?.height).toBeGreaterThan(0);

    await gpuLessPage.getByRole('button', { name: 'BEGIN', exact: true }).click();
    await expect(gpuLessPage.getByRole('button', { name: 'PAUSE', exact: true })).toBeVisible();

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
    expect(rendererMode === 'webgpu' || rendererMode === 'webgl2').toBe(true);
    await expect(container).toHaveAttribute('data-shader', 'sacred-monk.wgsl');

    const canvas = page.locator('canvas').first();
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox?.width).toBeGreaterThan(0);
    expect(canvasBox?.height).toBeGreaterThan(0);

    expect(errors).toHaveLength(0);
  });
});
