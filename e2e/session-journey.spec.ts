import { test, expect, type Page } from '@playwright/test';

test.setTimeout(90_000);

async function dismissOnboarding(page: Page) {
  const skipOnboarding = page.getByText('Skip onboarding');
  if (await skipOnboarding.isVisible().catch(() => false)) {
    await skipOnboarding.click({ force: true });
  }
}

async function setShortPhases(page: Page) {
  await page.getByRole('button', { name: '⚙️' }).click({ force: true });
  await expect(page.getByRole('heading', { name: 'Customize Breath' })).toBeVisible();

  const sliders = page.getByRole('slider');
  const count = await sliders.count();
  expect(count).toBeGreaterThanOrEqual(4);

  for (let i = 0; i < 4; i++) {
    await sliders.nth(i).fill('1');
  }

  await page.getByRole('button', { name: 'DONE' }).click({ force: true });
}

test.describe('session journey', () => {
  test('begin → phase transitions → instructor video → completion', async ({ page }) => {
    // Install before navigation so the app captures fake Date / rAF.
    // Keep the clock paused; advance via fastForward so each jump fires at most
    // one due rAF tick (runFor is too slow against a continuous breath rAF loop).
    await page.clock.install({ time: new Date('2026-07-22T12:00:00.000Z') });
    await page.goto('/');

    await dismissOnboarding(page);
    await expect(page.getByRole('heading', { name: 'SACRED BREATH', exact: true })).toBeVisible();

    await setShortPhases(page);

    // Timed session required for the completion overlay.
    await page.getByRole('button', { name: '5 MIN' }).first().click({ force: true });
    await expect(page.getByRole('button', { name: 'PAUSE', exact: true })).toBeVisible();

    // Fire the first rAF so the timer loop captures startTime and paints inhale.
    await page.clock.fastForward(16);

    const phase = page.locator('[data-tour="phase"]');
    await expect(phase).toBeVisible();

    const phasesSeen = new Set<string>();
    phasesSeen.add(((await phase.textContent()) ?? '').trim().toLowerCase());

    // 1s phases: each ~1.1s jump should land in the next phase.
    for (let i = 0; i < 6 && phasesSeen.size < 3; i++) {
      await page.clock.fastForward(1100);
      phasesSeen.add(((await phase.textContent()) ?? '').trim().toLowerCase());
    }
    expect(
      phasesSeen.size,
      `expected ≥3 distinct phases, saw: ${[...phasesSeen].join(', ')}`,
    ).toBeGreaterThanOrEqual(3);

    // Instructor guide — media clock is independent of page.clock.
    const instructorToggle = page.getByTitle('Show instructor guide');
    await expect(instructorToggle).toBeVisible({ timeout: 15_000 });
    await instructorToggle.click({ force: true });

    const video = page.locator('video').first();
    await expect(video).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(
        async () =>
          video.evaluate((el) => {
            const v = el as HTMLVideoElement;
            return !v.paused && v.currentTime > 0;
          }),
        { timeout: 20_000 },
      )
      .toBe(true);

    // Fine-grained ticks so the wrap detector (prev>0.95 → progress<0.05) can fire.
    // Coarse jumps skip the boundary and leave totalBreaths at 0 (no completion overlay).
    for (let i = 0; i < 45; i++) {
      await page.clock.fastForward(100);
    }

    // Jump past the 5-minute session boundary, then nudge one more frame.
    await page.clock.fastForward(5 * 60_000);
    await page.clock.fastForward(50);

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Session Complete/)).toBeVisible();
  });
});
