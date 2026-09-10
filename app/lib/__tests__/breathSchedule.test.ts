import { describe, it, expect } from 'vitest';
import {
  buildPhaseSchedule,
  countCompletedCycles,
  resolvePhaseAt,
  type BreathSettings,
} from '../breathSchedule';

const defaults: BreathSettings = { inhale: 4, hold1: 4, exhale: 6, hold2: 2 };

describe('buildPhaseSchedule', () => {
  it('lays the four phases out back to back', () => {
    const schedule = buildPhaseSchedule(defaults);

    expect(schedule.cycleMs).toBe(16_000);
    expect(schedule.totalCycleSec).toBe(16);
    expect(schedule.slots).toEqual([
      { phase: 'inhale', startMs: 0, endMs: 4_000, durationSec: 4 },
      { phase: 'hold1', startMs: 4_000, endMs: 8_000, durationSec: 4 },
      { phase: 'exhale', startMs: 8_000, endMs: 14_000, durationSec: 6 },
      { phase: 'hold2', startMs: 14_000, endMs: 16_000, durationSec: 2 },
    ]);
  });

  it('drops zero-duration phases entirely (4-7-8 has no holds after exhale)', () => {
    const schedule = buildPhaseSchedule({ inhale: 4, hold1: 7, exhale: 8, hold2: 0 });

    expect(schedule.slots.map((s) => s.phase)).toEqual(['inhale', 'hold1', 'exhale']);
    expect(schedule.cycleMs).toBe(19_000);
  });

  it('treats a negative duration as zero', () => {
    const schedule = buildPhaseSchedule({ inhale: 2, hold1: -3, exhale: 2, hold2: 0 });

    expect(schedule.slots.map((s) => s.phase)).toEqual(['inhale', 'exhale']);
    expect(schedule.cycleMs).toBe(4_000);
  });

  it('handles fractional phase lengths', () => {
    const schedule = buildPhaseSchedule({ inhale: 1.5, hold1: 0, exhale: 2.5, hold2: 0 });

    expect(schedule.cycleMs).toBe(4_000);
    expect(schedule.slots[1]).toEqual({
      phase: 'exhale',
      startMs: 1_500,
      endMs: 4_000,
      durationSec: 2.5,
    });
  });

  it('produces an empty schedule when every phase is zero', () => {
    const schedule = buildPhaseSchedule({ inhale: 0, hold1: 0, exhale: 0, hold2: 0 });

    expect(schedule.slots).toEqual([]);
    expect(schedule.cycleMs).toBe(0);
  });
});

describe('resolvePhaseAt', () => {
  const schedule = buildPhaseSchedule(defaults);

  it('opens on inhale with the full phase remaining', () => {
    expect(resolvePhaseAt(schedule, 0)).toMatchObject({
      phase: 'inhale',
      phaseElapsedSec: 0,
      phaseProgress: 0,
      remainingSec: 4,
      cycleProgress: 0,
      cycleIndex: 0,
      phaseOrdinal: 0,
      nextPhase: 'hold1',
      nextPhaseStartMs: 4_000,
    });
  });

  it('is exact on either side of a boundary millisecond', () => {
    expect(resolvePhaseAt(schedule, 3_999).phase).toBe('inhale');
    expect(resolvePhaseAt(schedule, 4_000)).toMatchObject({
      phase: 'hold1',
      phaseElapsedSec: 0,
      phaseStartMs: 4_000,
    });
  });

  it('reports progress and remaining time partway through a phase', () => {
    const snap = resolvePhaseAt(schedule, 6_000);

    expect(snap.phase).toBe('hold1');
    expect(snap.phaseElapsedSec).toBe(2);
    expect(snap.phaseProgress).toBeCloseTo(0.5, 5);
    expect(snap.remainingSec).toBeCloseTo(2, 5);
    expect(snap.cycleProgress).toBeCloseTo(6 / 16, 5);
  });

  it('wraps into later cycles and keeps ordinals increasing', () => {
    const first = resolvePhaseAt(schedule, 6_000);
    const third = resolvePhaseAt(schedule, 2 * 16_000 + 6_000);

    expect(third.phase).toBe(first.phase);
    expect(third.phaseElapsedSec).toBe(first.phaseElapsedSec);
    expect(third.cycleIndex).toBe(2);
    expect(third.phaseOrdinal).toBe(first.phaseOrdinal + 8);
    expect(third.phaseStartMs).toBe(first.phaseStartMs + 32_000);
  });

  it('never resolves to a skipped zero-duration phase', () => {
    const zeroHold = buildPhaseSchedule({ inhale: 2, hold1: 0, exhale: 2, hold2: 0 });

    for (let ms = 0; ms < 8_000; ms += 25) {
      const phase = resolvePhaseAt(zeroHold, ms).phase;
      expect(phase === 'inhale' || phase === 'exhale').toBe(true);
    }
    // The phase after exhale is the next inhale, not a collapsed hold.
    expect(resolvePhaseAt(zeroHold, 3_000).nextPhase).toBe('inhale');
  });

  it('clamps negative elapsed to the timeline origin', () => {
    expect(resolvePhaseAt(schedule, -5_000)).toMatchObject({ phase: 'inhale', phaseElapsedSec: 0 });
  });

  it('returns a neutral snapshot for a degenerate schedule', () => {
    const empty = buildPhaseSchedule({ inhale: 0, hold1: 0, exhale: 0, hold2: 0 });

    expect(resolvePhaseAt(empty, 1_234)).toMatchObject({
      phase: 'inhale',
      phaseDurationSec: 0,
      phaseProgress: 0,
      cycleIndex: 0,
    });
  });

  it('holds progress at 1 at the very end of the last phase', () => {
    const snap = resolvePhaseAt(schedule, 15_999);

    expect(snap.phase).toBe('hold2');
    expect(snap.phaseProgress).toBeLessThanOrEqual(1);
    expect(snap.nextPhase).toBe('inhale');
    expect(snap.nextPhaseStartMs).toBe(16_000);
  });
});

describe('countCompletedCycles', () => {
  const schedule = buildPhaseSchedule(defaults);

  it('counts whole cycles only', () => {
    expect(countCompletedCycles(schedule, 0)).toBe(0);
    expect(countCompletedCycles(schedule, 15_999)).toBe(0);
    expect(countCompletedCycles(schedule, 16_000)).toBe(1);
    expect(countCompletedCycles(schedule, 16_001)).toBe(1);
  });

  it('counts every cycle a throttled frame jumped over', () => {
    expect(countCompletedCycles(schedule, 10 * 16_000 + 500)).toBe(10);
  });

  it('is zero for negative elapsed or a degenerate schedule', () => {
    expect(countCompletedCycles(schedule, -1_000)).toBe(0);
    expect(countCompletedCycles(buildPhaseSchedule({ inhale: 0, hold1: 0, exhale: 0, hold2: 0 }), 5_000)).toBe(0);
  });
});
