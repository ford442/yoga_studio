import { describe, it, expect } from 'vitest';
import {
  ANTICIPATION_LEAD_SEC,
  HARD_SNAP_SEC,
  RATE_MAX,
  RATE_MIN,
  computePlaybackRate,
  computeTargetTime,
  computeTargetTimeFromElapsed,
} from '../instructorSync';

describe('computeTargetTime', () => {
  it('leads plain phaseProgress * clipDuration by anticipation', () => {
    const phaseDurationSec = 10;
    const clipDuration = 6;
    const phaseProgress = 0.4;

    const target = computeTargetTime(phaseProgress, phaseDurationSec, clipDuration);
    const plain = phaseProgress * clipDuration;
    const expectedLead = (ANTICIPATION_LEAD_SEC / phaseDurationSec) * clipDuration;

    expect(target).toBeCloseTo(plain + expectedLead, 5);
    expect(target).toBeGreaterThan(plain);
  });

  it('clamps to clipDuration at end of phase', () => {
    const target = computeTargetTime(1, 8, 5);
    expect(target).toBe(5);
  });

  it('clamps anticipation so progress never exceeds 1', () => {
    // Near end: lead would push past 1 without clamp
    const target = computeTargetTime(0.99, 1, 4);
    expect(target).toBe(4);
  });
});

describe('computePlaybackRate', () => {
  it('returns idealRate when drift is zero (after anticipation)', () => {
    const phaseDurationSec = 10;
    const clipDuration = 6;
    const phaseProgress = 0.3;
    const target = computeTargetTime(phaseProgress, phaseDurationSec, clipDuration);

    const result = computePlaybackRate({
      phaseElapsedSec: phaseProgress * phaseDurationSec,
      phaseDurationSec,
      clipDuration,
      currentTime: target,
    });

    expect('rate' in result).toBe(true);
    if ('rate' in result) {
      expect(result.rate).toBeCloseTo(clipDuration / phaseDurationSec, 5);
      expect(result.rate).toBeCloseTo(0.6, 5);
    }
  });

  it('raises rate when video is behind (positive drift)', () => {
    const phaseDurationSec = 10;
    const clipDuration = 6;
    const phaseProgress = 0.5;
    const target = computeTargetTime(phaseProgress, phaseDurationSec, clipDuration);
    const idealRate = clipDuration / phaseDurationSec;

    const result = computePlaybackRate({
      phaseElapsedSec: phaseProgress * phaseDurationSec,
      phaseDurationSec,
      clipDuration,
      currentTime: target - 0.2,
    });

    expect('rate' in result).toBe(true);
    if ('rate' in result) {
      expect(result.rate).toBeGreaterThan(idealRate);
    }
  });

  it('lowers rate when video is ahead (negative drift)', () => {
    const phaseDurationSec = 10;
    const clipDuration = 6;
    const phaseProgress = 0.5;
    const target = computeTargetTime(phaseProgress, phaseDurationSec, clipDuration);
    const idealRate = clipDuration / phaseDurationSec;

    const result = computePlaybackRate({
      phaseElapsedSec: phaseProgress * phaseDurationSec,
      phaseDurationSec,
      clipDuration,
      currentTime: target + 0.2,
    });

    expect('rate' in result).toBe(true);
    if ('rate' in result) {
      expect(result.rate).toBeLessThan(idealRate);
    }
  });

  it('clamps rate to [RATE_MIN, RATE_MAX] under extreme drift', () => {
    const phaseDurationSec = 4;
    const clipDuration = 4;
    const phaseProgress = 0.5;
    const target = computeTargetTime(phaseProgress, phaseDurationSec, clipDuration);

    const high = computePlaybackRate({
      phaseElapsedSec: phaseProgress * phaseDurationSec,
      phaseDurationSec,
      clipDuration,
      currentTime: target - 0.4, // large positive drift, under hard-snap
    });
    const low = computePlaybackRate({
      phaseElapsedSec: phaseProgress * phaseDurationSec,
      phaseDurationSec,
      clipDuration,
      currentTime: target + 0.4,
    });

    expect('rate' in high).toBe(true);
    expect('rate' in low).toBe(true);
    if ('rate' in high) {
      expect(high.rate).toBeLessThanOrEqual(RATE_MAX);
      expect(high.rate).toBeGreaterThanOrEqual(RATE_MIN);
    }
    if ('rate' in low) {
      expect(low.rate).toBeLessThanOrEqual(RATE_MAX);
      expect(low.rate).toBeGreaterThanOrEqual(RATE_MIN);
    }
  });

  it('hard-snaps when abs(drift) exceeds HARD_SNAP_SEC', () => {
    const phaseDurationSec = 10;
    const clipDuration = 6;
    const phaseProgress = 0.4;
    const target = computeTargetTime(phaseProgress, phaseDurationSec, clipDuration);

    const behind = computePlaybackRate({
      phaseElapsedSec: phaseProgress * phaseDurationSec,
      phaseDurationSec,
      clipDuration,
      currentTime: target - (HARD_SNAP_SEC + 0.1),
    });
    const ahead = computePlaybackRate({
      phaseElapsedSec: phaseProgress * phaseDurationSec,
      phaseDurationSec,
      clipDuration,
      currentTime: target + (HARD_SNAP_SEC + 0.1),
    });

    expect(behind).toEqual({ seekTo: target });
    expect(ahead).toEqual({ seekTo: target });
  });

  it('does not hard-snap when drift is exactly at the soft boundary', () => {
    const phaseDurationSec = 10;
    const clipDuration = 6;
    const phaseProgress = 0.4;
    const target = computeTargetTime(phaseProgress, phaseDurationSec, clipDuration);

    // Threshold is strict > HARD_SNAP_SEC, so equal drift stays on rate path.
    const result = computePlaybackRate({
      phaseElapsedSec: phaseProgress * phaseDurationSec,
      phaseDurationSec,
      clipDuration,
      currentTime: target - HARD_SNAP_SEC,
    });

    expect('rate' in result).toBe(true);
  });
});

describe('lockstep convergence over a phase', () => {
  /**
   * Replays the guide's rAF control loop against a simulated video element to
   * check the accuracy the phase-accurate instructor sync promises: the clip's
   * currentTime tracks computeTargetTimeFromElapsed within 100ms.
   */
  const runPhase = (opts: {
    phaseDurationSec: number;
    clipDuration: number;
    startCurrentTime: number;
    frameSec?: number;
  }) => {
    const { phaseDurationSec, clipDuration, startCurrentTime, frameSec = 1 / 60 } = opts;
    let currentTime = startCurrentTime;
    let rate = 1;
    const drifts: { elapsed: number; drift: number }[] = [];

    for (let elapsed = 0; elapsed <= phaseDurationSec; elapsed += frameSec) {
      const target = computeTargetTimeFromElapsed(elapsed, phaseDurationSec, clipDuration);
      drifts.push({ elapsed, drift: Math.abs(target - currentTime) });

      const action = computePlaybackRate({
        phaseElapsedSec: elapsed,
        phaseDurationSec,
        clipDuration,
        currentTime,
      });
      if ('seekTo' in action) {
        currentTime = action.seekTo;
      } else {
        rate = action.rate;
      }
      currentTime += rate * frameSec;
    }
    return drifts;
  };

  /**
   * Frames where lockstep is meaningful. The last ANTICIPATION_LEAD_SEC of a
   * phase is deliberately clamped to the clip's final frame, so the target
   * stops advancing there by design.
   */
  const settledFrames = (drifts: { elapsed: number; drift: number }[], phaseDurationSec: number) =>
    drifts.filter((d) => d.elapsed > 0.25 && d.elapsed <= phaseDurationSec - ANTICIPATION_LEAD_SEC);

  it('holds a 4s phase within 100ms of the target after settling', () => {
    const drifts = runPhase({ phaseDurationSec: 4, clipDuration: 3, startCurrentTime: 0 });
    // Allow a few frames to settle, then require the 100ms accuracy bound.
    const settled = settledFrames(drifts, 4);

    expect(settled.length).toBeGreaterThan(100);
    for (const { elapsed, drift } of settled) {
      expect(drift, `drift ${drift.toFixed(4)}s at t=${elapsed.toFixed(3)}s`).toBeLessThanOrEqual(0.1);
    }
  });

  it('recovers to within 100ms after a stall throws the clip far off', () => {
    // Backgrounded tab: the clip is a full second behind when the loop resumes.
    const drifts = runPhase({
      phaseDurationSec: 4,
      clipDuration: 3,
      startCurrentTime: -1,
    });

    expect(drifts[0].drift).toBeGreaterThan(0.5);
    // The hard snap fires on the first frame, so recovery is immediate.
    expect(drifts[1].drift).toBeLessThanOrEqual(0.1);
    for (const { drift } of settledFrames(drifts, 4)) {
      expect(drift).toBeLessThanOrEqual(0.1);
    }
  });

  it('keeps a 1s test-slider phase inside the same bound', () => {
    const drifts = runPhase({ phaseDurationSec: 1, clipDuration: 3, startCurrentTime: 0 });
    const settled = settledFrames(drifts, 1);

    expect(settled.length).toBeGreaterThan(20);
    for (const { drift } of settled) {
      expect(drift).toBeLessThanOrEqual(0.1);
    }
  });
});
