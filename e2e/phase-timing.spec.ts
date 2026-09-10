import { test, expect } from '@playwright/test';
import {
  fastForwardTo,
  openPractice,
  pageNow,
  pauseClock,
  readPhase,
  setPhaseLengths,
} from './helpers/practice';

test.setTimeout(120_000);

const PHASE_ORDER = ['inhale', 'hold1', 'exhale', 'hold2'] as const;

test.describe('breath phase timing', () => {
  test('phase boundaries stay on the analytical schedule across ten minutes', async ({ page }) => {
    await openPractice(page, '2026-07-22T12:00:00.000Z');
    await setPhaseLengths(page, 1);

    await pauseClock(page);

    // Free practice: no auto-end to interrupt the ten-minute run.
    await page.getByRole('button', { name: 'BEGIN', exact: true }).click();
    const anchorMs = await pageNow(page);
    await page.clock.fastForward(16);
    await expect(page.getByRole('button', { name: 'PAUSE', exact: true })).toBeVisible();

    // 1s phases → a 4s cycle. Sample the middle of a given phase ordinal, which
    // is immune to single-frame jitter but catches any real drift: a schedule
    // that slipped by even half a phase would report the wrong label.
    const sampleOrdinals = [0, 1, 2, 3, 4, 37, 200, 599, 1199, 1200, 1201];
    for (const ordinal of sampleOrdinals) {
      await fastForwardTo(page, anchorMs + ordinal * 1_000 + 500);
      expect(
        await readPhase(page),
        `phase ordinal ${ordinal} at ${(ordinal + 0.5).toFixed(1)}s`,
      ).toBe(PHASE_ORDER[ordinal % 4]);
    }

    // Ordinal 1200 begins at exactly 600s, so ten minutes of simulated time
    // elapsed without the schedule losing or gaining a single phase.
    expect(await pageNow(page)).toBeGreaterThanOrEqual(anchorMs + 600_000);
  });

  test('phase transitions land within one frame of the scheduled millisecond', async ({ page }) => {
    await openPractice(page, '2026-07-22T12:00:00.000Z');
    await setPhaseLengths(page, 1);

    await pauseClock(page);
    await page.getByRole('button', { name: 'BEGIN', exact: true }).click();
    const anchorMs = await pageNow(page);
    await page.clock.fastForward(16);

    // Just short of each boundary the old phase still shows; one frame past it
    // the new one does. rAF resolution (~16ms) is the only slack allowed.
    for (let ordinal = 0; ordinal < 6; ordinal++) {
      const boundaryMs = anchorMs + (ordinal + 1) * 1_000;

      await fastForwardTo(page, boundaryMs - 20);
      expect(await readPhase(page), `before boundary ${ordinal + 1}`).toBe(PHASE_ORDER[ordinal % 4]);

      await fastForwardTo(page, boundaryMs + 20);
      expect(await readPhase(page), `after boundary ${ordinal + 1}`).toBe(
        PHASE_ORDER[(ordinal + 1) % 4],
      );
    }
  });

  test('pause and resume neither skips nor repeats a phase', async ({ page }) => {
    await openPractice(page, '2026-07-22T12:00:00.000Z');
    await setPhaseLengths(page, 2);

    const begin = page.getByRole('button', { name: 'BEGIN', exact: true });
    const pause = page.getByRole('button', { name: 'PAUSE', exact: true });

    await pauseClock(page);
    await begin.click();
    const anchorMs = await pageNow(page);
    await page.clock.fastForward(16);

    // 1s into a 2s inhale.
    await fastForwardTo(page, anchorMs + 1_000);
    expect(await readPhase(page)).toBe('inhale');

    await pause.click();
    await expect(begin).toBeVisible();

    // Half a minute of wall clock passes while paused; the breath timeline is
    // frozen, so the phase must not move on.
    await page.clock.fastForward(30_000);
    expect(await readPhase(page)).toBe('inhale');

    await begin.click();
    const resumeMs = await pageNow(page);
    await page.clock.fastForward(16);

    // 0.9s of the inhale was left: still inhale here, hold1 just after.
    await fastForwardTo(page, resumeMs + 900);
    expect(await readPhase(page), 'the rest of the interrupted inhale is honoured').toBe('inhale');

    await fastForwardTo(page, resumeMs + 1_100);
    expect(await readPhase(page), 'the phase after the interrupted inhale').toBe('hold1');

    // And the cycle continues in order from there, with no repeated phase.
    for (const [index, expected] of (['exhale', 'hold2', 'inhale'] as const).entries()) {
      await fastForwardTo(page, resumeMs + 1_000 + (index + 1) * 2_000 + 100);
      expect(await readPhase(page)).toBe(expected);
    }
  });
});
