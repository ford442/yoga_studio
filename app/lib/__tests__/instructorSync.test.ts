import { describe, it, expect } from 'vitest';
import {
  ANTICIPATION_LEAD_SEC,
  HARD_SNAP_SEC,
  RATE_MAX,
  RATE_MIN,
  computePlaybackRate,
  computeTargetTime,
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
      phaseProgress,
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
      phaseProgress,
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
      phaseProgress,
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
      phaseProgress,
      phaseDurationSec,
      clipDuration,
      currentTime: target - 0.4, // large positive drift, under hard-snap
    });
    const low = computePlaybackRate({
      phaseProgress,
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
      phaseProgress,
      phaseDurationSec,
      clipDuration,
      currentTime: target - (HARD_SNAP_SEC + 0.1),
    });
    const ahead = computePlaybackRate({
      phaseProgress,
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
      phaseProgress,
      phaseDurationSec,
      clipDuration,
      currentTime: target - HARD_SNAP_SEC,
    });

    expect('rate' in result).toBe(true);
  });
});
