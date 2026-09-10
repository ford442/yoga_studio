import { test, expect } from '@playwright/test';
import { openPractice, pageNow, readPhase, setPhaseLengths } from './helpers/practice';

test.setTimeout(90_000);

test.describe('session journey', () => {
  test('begin → phase transitions → instructor video → completion', async ({ page }) => {
    // Advance via fastForward so each jump fires at most one due rAF tick
    // (runFor is too slow against a continuous breath rAF loop). The clock is
    // left ticking here so the instructor <video> below can actually load.
    await openPractice(page, '2026-07-22T12:00:00.000Z');
    await setPhaseLengths(page, 1);

    // Timed session required for the completion overlay. Match the footer
    // quick-start exactly: the technique card and the beginner card both carry
    // a "… 5 MIN" label and reapply their mode's breath defaults on click.
    const quickStart = page.getByRole('button', { name: '5 MIN', exact: true }).last();
    await expect(quickStart).toBeVisible();
    // Unforced: let Playwright wait out the drawer's exit animation rather than
    // dispatching the click into the overlay that is still on top.
    await quickStart.click();
    // The clock only advances on fastForward, so reading it before the first
    // tick gives the session's monotonic anchor exactly.
    const sessionAnchorMs = await pageNow(page);
    // Fire the first rAF so the timer loop captures startTime and paints inhale.
    await page.clock.fastForward(16);
    await expect(page.getByRole('button', { name: 'PAUSE', exact: true })).toBeVisible();

    const phase = page.locator('[data-tour="phase"]');
    await expect(phase).toBeVisible();

    const phasesSeen = new Set<string>();
    expect(await readPhase(page)).toBe('inhale');
    phasesSeen.add(await readPhase(page));

    // 1s phases: each ~1.1s jump should land in the next phase.
    for (let i = 0; i < 6 && phasesSeen.size < 3; i++) {
      await page.clock.fastForward(1100);
      phasesSeen.add(await readPhase(page));
    }
    expect(
      phasesSeen.size,
      `expected ≥3 distinct phases, saw: ${[...phasesSeen].join(', ')}`,
    ).toBeGreaterThanOrEqual(3);

    // Instructor guide — media clock is independent of page.clock.
    const video = page.locator('video').first();
    if (!(await video.isVisible().catch(() => false))) {
      const instructorToggle = page.getByTitle('Show instructor guide');
      await expect(instructorToggle).toBeVisible({ timeout: 15_000 });
      await instructorToggle.click({ force: true });
    }
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

    // The engine counts cycles from its monotonic schedule, so one coarse jump
    // past the 5-minute deadline is enough — no fine ticking to catch a wrap.
    // Land 20ms past the deadline so the auto-end frame sees the analytical
    // elapsed time rather than an arbitrary overshoot.
    const elapsedMs = (await pageNow(page)) - sessionAnchorMs;
    await page.clock.fastForward(Math.round(5 * 60_000 - elapsedMs) + 20);
    for (let i = 0; i < 10 && !(await page.getByRole('dialog').isVisible().catch(() => false)); i++) {
      await page.clock.fastForward(50);
    }

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Session Complete/)).toBeVisible();

    // Analytical breath count: 300s of 1s phases = 75 complete 4s cycles.
    await expect(page.getByText('CONSCIOUS BREATHS')).toBeVisible();
    await expect(
      page.getByText('CONSCIOUS BREATHS').locator('xpath=preceding-sibling::div[1]'),
    ).toHaveText('75');
  });
});
