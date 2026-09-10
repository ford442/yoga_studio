import { expect, type Page } from '@playwright/test';

/**
 * Dismisses the welcome panel. It mounts after hydration and overlays the
 * footer controls, and it animates in from zero height, so `isVisible` can
 * still be false while it is already intercepting clicks — wait on attachment.
 */
export async function dismissOnboarding(page: Page) {
  const welcome = page.locator('section[aria-label="Welcome to Sacred Breath"]');
  const skipOnboarding = page.getByRole('button', { name: /Skip onboarding/ });
  const appeared = await skipOnboarding
    .waitFor({ state: 'attached', timeout: 10_000 })
    .then(() => true, () => false);
  if (!appeared) return;

  await skipOnboarding.click({ force: true });
  await page.clock.fastForward(16);
  await welcome.waitFor({ state: 'detached' });
}

/** Sets every breath phase to the same length via the settings drawer. */
export async function setPhaseLengths(page: Page, seconds: number) {
  await page.getByRole('button', { name: 'Open settings' }).click({ force: true });
  await expect(page.getByRole('heading', { name: 'Customize Breath' })).toBeVisible();

  const sliders = page.getByRole('slider');
  expect(await sliders.count()).toBeGreaterThanOrEqual(4);
  for (let i = 0; i < 4; i++) {
    await sliders.nth(i).fill(String(seconds));
  }

  await page.getByRole('button', { name: 'DONE' }).click({ force: true });
  // The drawer overlays the controls while it animates out; clicking through it
  // would land on the overlay instead of the quick-start row.
  await expect(page.getByRole('heading', { name: 'Customize Breath' })).toBeHidden();
}

/** Boots the app on a fake clock with onboarding out of the way. */
export async function openPractice(page: Page, isoTime: string) {
  // Install before navigation so the app captures the fake Date / performance / rAF.
  // The clock still ticks at this point: hydration and the drawer transitions
  // need it to. Call `pauseClock` once the session is about to start.
  await page.clock.install({ time: new Date(isoTime) });
  await page.goto('/');
  await dismissOnboarding(page);
  await expect(page.getByRole('heading', { name: 'SACRED BREATH', exact: true })).toBeVisible();
}

/**
 * Freezes the fake clock so it only advances by explicit fastForward. Without
 * this an `install`ed clock keeps ticking in real time and the engine's anchor
 * drifts away from what the test measured.
 */
export async function pauseClock(page: Page) {
  // A small margin: pauseAt refuses a time already in the past, and the clock
  // keeps ticking between reading it and issuing the pause.
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);
}

export const readPhase = async (page: Page) =>
  ((await page.locator('[data-tour="phase"]').textContent()) ?? '').trim().toLowerCase();

/** Monotonic clock reading inside the page; only fastForward advances it. */
export const pageNow = (page: Page) => page.evaluate(() => performance.now());

/** Advances the paused clock so that `performance.now()` lands on `targetMs`. */
export async function fastForwardTo(page: Page, targetMs: number) {
  const delta = targetMs - (await pageNow(page));
  expect(delta, 'clock can only move forward').toBeGreaterThanOrEqual(0);
  await page.clock.fastForward(Math.round(delta));
}
