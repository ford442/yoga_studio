import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useBreathTimer } from '../useBreathTimer';

describe('useBreathTimer', () => {
  beforeEach(() => {
    // `performance` is faked alongside Date: the engine is driven by the
    // monotonic clock, and Date is only used for wall-clock segment stamps.
    vi.useFakeTimers({ toFake: ['Date', 'requestAnimationFrame', 'performance'] });
    vi.setSystemTime(new Date('2026-07-16T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts a timed session in the inhale phase', () => {
    const { result } = renderHook(() => useBreathTimer());

    act(() => {
      result.current.startSession(5);
    });

    expect(result.current.isRunning).toBe(true);
    expect(result.current.sessionDuration).toBe(5);
    expect(result.current.currentPhase).toBe('inhale');
    expect(result.current.totalBreaths).toBe(0);
    expect(result.current.breathPhase).toBeCloseTo(0, 2);
  });

  it('cycles through inhale -> hold1 -> exhale -> hold2', async () => {
    const { result } = renderHook(() => useBreathTimer());

    act(() => {
      result.current.startSession(10);
    });

    // Defaults: inhale 4s, hold1 4s, exhale 6s, hold2 2s
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    await waitFor(() => expect(result.current.currentPhase).toBe('inhale'));

    await act(async () => {
      vi.advanceTimersByTime(2500);
    });
    await waitFor(() => expect(result.current.currentPhase).toBe('hold1'));

    await act(async () => {
      vi.advanceTimersByTime(4500);
    });
    await waitFor(() => expect(result.current.currentPhase).toBe('exhale'));

    await act(async () => {
      vi.advanceTimersByTime(6500);
    });
    await waitFor(() => expect(result.current.currentPhase).toBe('hold2'));
  });

  it('lands phase boundaries on the exact scheduled millisecond', async () => {
    const { result } = renderHook(() => useBreathTimer());

    act(() => {
      result.current.startSession(10);
    });

    // The schedule lookup is exact: 1ms before the 4000ms boundary is still
    // inhale, and the boundary millisecond itself is hold1 at zero elapsed.
    await act(async () => {
      vi.advanceTimersByTime(3_999);
    });
    expect(result.current.getPhaseSnapshot()).toMatchObject({
      phase: 'inhale',
      phaseElapsedSec: 3.999,
    });

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.getPhaseSnapshot()).toMatchObject({
      phase: 'hold1',
      phaseElapsedSec: 0,
      phaseDurationSec: 4,
    });

    // The rendered value follows within one frame.
    await act(async () => {
      vi.advanceTimersByTime(17);
    });
    await waitFor(() => expect(result.current.currentPhase).toBe('hold1'));
  });

  it('exposes the next phase boundary on the monotonic clock', async () => {
    const { result } = renderHook(() => useBreathTimer());

    act(() => {
      result.current.startSession(10);
    });
    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });

    await waitFor(() => expect(result.current.nextPhase).toBe('hold1'));
    // Inhale ends 4s after the anchor, which is `now - 1000ms`.
    expect(result.current.nextPhaseAtMs - performance.now()).toBeCloseTo(3_000, -1);
  });

  it('increments totalBreaths once per full cycle', async () => {
    const { result } = renderHook(() => useBreathTimer());

    act(() => {
      result.current.startSession(10);
    });

    // One full cycle = 16s with defaults; advance slightly past the wrap.
    await act(async () => {
      vi.advanceTimersByTime(16_050);
    });

    await waitFor(() => expect(result.current.totalBreaths).toBe(1));

    await act(async () => {
      vi.advanceTimersByTime(16_050);
    });

    await waitFor(() => expect(result.current.totalBreaths).toBe(2));
  });

  it('counts every cycle a single throttled frame jumped over', async () => {
    const { result } = renderHook(() => useBreathTimer());

    act(() => {
      result.current.startSession(10);
    });

    // Backgrounded tab: one huge jump spanning five cycles (16s each).
    await act(async () => {
      vi.advanceTimersByTime(80_100);
    });

    await waitFor(() => expect(result.current.totalBreaths).toBe(5));
  });

  it('auto-ends a timed session after the configured duration', async () => {
    const { result } = renderHook(() => useBreathTimer());

    act(() => {
      result.current.startSession(5);
    });

    await act(async () => {
      vi.advanceTimersByTime(5 * 60_050);
    });

    expect(result.current.isRunning).toBe(false);
    expect(result.current.sessionDuration).toBeNull();
    expect(result.current.completedSegment).toMatchObject({ kind: 'timed', durationSec: 300 });
  });

  it.each([5, 10, 15] as const)('auto-ends a %i minute session at its boundary', async (minutes) => {
    const { result } = renderHook(() => useBreathTimer());

    act(() => {
      result.current.startSession(minutes);
    });

    await act(async () => {
      vi.advanceTimersByTime(minutes * 60_000 - 100);
    });
    expect(result.current.isRunning).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.isRunning).toBe(false);
    expect(result.current.completedSegment).toMatchObject({
      kind: 'timed',
      durationSec: minutes * 60,
    });
  });

  it('toggles free-form practice without a duration', () => {
    const { result } = renderHook(() => useBreathTimer());

    act(() => {
      result.current.toggleFree();
    });

    expect(result.current.isRunning).toBe(true);
    expect(result.current.sessionDuration).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    act(() => {
      result.current.toggleFree();
    });

    expect(result.current.isRunning).toBe(false);
    expect(result.current.completedSegment).toBeNull();
  });

  it('resumes mid-phase after a pause instead of restarting the cycle', async () => {
    const { result } = renderHook(() => useBreathTimer());

    act(() => {
      result.current.toggleFree();
    });
    // 5s in: 1s into hold1 (inhale is 4s).
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    await waitFor(() => expect(result.current.currentPhase).toBe('hold1'));

    act(() => {
      result.current.toggleFree();
    });
    const pausedRemaining = result.current.remaining;
    expect(pausedRemaining).toBeCloseTo(3, 1);

    // Wall-clock passes while paused; the breath timeline must not move.
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current.currentPhase).toBe('hold1');
    expect(result.current.remaining).toBeCloseTo(pausedRemaining, 5);

    act(() => {
      result.current.toggleFree();
    });
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current.currentPhase).toBe('hold1');
    expect(result.current.remaining).toBeLessThan(pausedRemaining);
    expect(result.current.remaining).toBeGreaterThan(pausedRemaining - 0.5);
  });

  it('neither skips nor repeats a phase across a pause/resume', async () => {
    const { result } = renderHook(() => useBreathTimer());

    act(() => {
      result.current.toggleFree();
    });
    await act(async () => {
      vi.advanceTimersByTime(3_900);
    });
    await waitFor(() => expect(result.current.currentPhase).toBe('inhale'));
    const ordinalBefore = result.current.phaseOrdinal;

    act(() => {
      result.current.toggleFree();
    });
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    act(() => {
      result.current.toggleFree();
    });

    // Still the same inhale; 100ms later it advances to hold1 exactly once.
    expect(result.current.phaseOrdinal).toBe(ordinalBefore);
    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    await waitFor(() => expect(result.current.currentPhase).toBe('hold1'));
    expect(result.current.phaseOrdinal).toBe(ordinalBefore + 1);
  });

  it('records a free segment on pause after a completed breath', async () => {
    const { result } = renderHook(() => useBreathTimer());
    act(() => result.current.toggleFree());
    await act(async () => vi.advanceTimersByTime(16_050));
    await waitFor(() => expect(result.current.totalBreaths).toBe(1));
    act(() => result.current.toggleFree());
    expect(result.current.completedSegment).toMatchObject({ kind: 'free', breaths: 1 });
    expect(result.current.completedSegment?.durationSec).toBeGreaterThanOrEqual(16);
  });

  it('keeps cumulative breaths while logging separate free segments', async () => {
    const { result } = renderHook(() => useBreathTimer());
    act(() => result.current.toggleFree());
    await act(async () => vi.advanceTimersByTime(16_050));
    await waitFor(() => expect(result.current.totalBreaths).toBe(1));
    act(() => result.current.toggleFree());
    const firstId = result.current.completedSegment?.id;
    const breathsAfterFirst = result.current.totalBreaths;
    act(() => result.current.toggleFree());
    await act(async () => vi.advanceTimersByTime(16_050));
    await waitFor(() => expect(result.current.totalBreaths).toBeGreaterThan(breathsAfterFirst));
    act(() => result.current.toggleFree());
    expect(result.current.completedSegment).toMatchObject({ kind: 'free' });
    expect(result.current.completedSegment?.breaths).toBe(result.current.totalBreaths - breathsAfterFirst);
    expect(result.current.completedSegment?.id).not.toBe(firstId);
    expect(result.current.totalBreaths).toBeGreaterThan(breathsAfterFirst);
  });

  it('discards a running free segment on reset', async () => {
    const { result } = renderHook(() => useBreathTimer());
    act(() => result.current.toggleFree());
    await act(async () => vi.advanceTimersByTime(16_050));
    await waitFor(() => expect(result.current.totalBreaths).toBe(1));
    act(() => result.current.reset());
    expect(result.current.completedSegment).toBeNull();
  });

  it('reset returns everything to the initial state', () => {
    const { result } = renderHook(() => useBreathTimer());

    act(() => {
      result.current.startSession(5);
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.isRunning).toBe(false);
    expect(result.current.breathPhase).toBe(0);
    expect(result.current.totalBreaths).toBe(0);
    expect(result.current.sessionDuration).toBeNull();
    expect(result.current.currentPhase).toBe('inhale');
  });

  it('updateSettings changes phase durations and cycle length', async () => {
    const { result } = renderHook(() => useBreathTimer());

    act(() => {
      result.current.updateSettings({ inhale: 2, hold1: 2, exhale: 2, hold2: 2 });
    });
    expect(result.current.totalCycle).toBe(8);

    act(() => {
      result.current.startSession(10);
    });

    await act(async () => {
      vi.advanceTimersByTime(2500);
    });
    await waitFor(() => expect(result.current.currentPhase).toBe('hold1'));

    await act(async () => {
      vi.advanceTimersByTime(4500);
    });
    await waitFor(() => expect(result.current.currentPhase).toBe('hold2'));
  });

  it('skips a zero-duration hold2 and wraps exhale to inhale', async () => {
    const { result } = renderHook(() => useBreathTimer());

    act(() => {
      result.current.updateSettings({ inhale: 2, hold1: 2, exhale: 2, hold2: 0 });
    });
    act(() => {
      result.current.startSession(10);
    });

    // Mid-exhale
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    await waitFor(() => expect(result.current.currentPhase).toBe('exhale'));

    // Past cycle end (tct = 6s) — should wrap to inhale, never hold2
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    await waitFor(() => expect(result.current.currentPhase).toBe('inhale'));
    expect(result.current.currentPhase).not.toBe('hold2');
  });

  it('never announces a zero-duration phase as the next boundary', async () => {
    const { result } = renderHook(() => useBreathTimer());

    act(() => {
      // 4-7-8 shape: both holds after exhale collapse to nothing.
      result.current.updateSettings({ inhale: 4, hold1: 7, exhale: 8, hold2: 0 });
    });
    act(() => {
      result.current.startSession(10);
    });

    await act(async () => {
      vi.advanceTimersByTime(11_500);
    });
    await waitFor(() => expect(result.current.currentPhase).toBe('exhale'));
    expect(result.current.nextPhase).toBe('inhale');
  });

  it('remaps wall-clock elapsed onto new tct when settings change mid-session', async () => {
    // The monotonic timeline keeps running; a settings change re-derives the
    // schedule under it (continuous elapsed % newCycle), it does not rebase.
    const { result } = renderHook(() => useBreathTimer());

    act(() => {
      result.current.startSession(10);
    });

    // Defaults tct=16; past inhale+hold1 (8s) so we are in exhale
    await act(async () => {
      vi.advanceTimersByTime(4500);
    });
    await waitFor(() => expect(result.current.currentPhase).toBe('hold1'));

    await act(async () => {
      vi.advanceTimersByTime(4500);
    });
    await waitFor(() => expect(result.current.currentPhase).toBe('exhale'));
    // ~9/16 of the cycle
    expect(result.current.breathPhase).toBeCloseTo(9 / 16, 1);

    act(() => {
      result.current.updateSettings({ inhale: 2, hold1: 2, exhale: 2, hold2: 2 });
    });

    // Next ticks: elapsed≈9, newTct=8 → 9%8=1 → inhale / breathPhase≈0.125
    await act(async () => {
      vi.advanceTimersByTime(16);
    });
    await waitFor(() => expect(result.current.currentPhase).toBe('inhale'));
    expect(result.current.breathPhase).toBeCloseTo(1 / 8, 1);
  });

  it('keeps counting breaths against the new cycle after a settings change', async () => {
    const { result } = renderHook(() => useBreathTimer());

    act(() => {
      result.current.startSession(10);
    });
    await act(async () => {
      vi.advanceTimersByTime(4_000);
    });

    act(() => {
      result.current.updateSettings({ inhale: 1, hold1: 1, exhale: 1, hold2: 1 });
    });

    // elapsed 4s already covers one 4s cycle; 8s more adds two.
    await act(async () => {
      vi.advanceTimersByTime(8_100);
    });
    await waitFor(() => expect(result.current.totalBreaths).toBe(3));
  });

  it('auto-ends at the session boundary but not just under it', async () => {
    const { result } = renderHook(() => useBreathTimer());

    act(() => {
      result.current.startSession(5);
    });

    await act(async () => {
      vi.advanceTimersByTime(5 * 60_000 - 50);
    });
    expect(result.current.isRunning).toBe(true);
    expect(result.current.sessionDuration).toBe(5);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.isRunning).toBe(false);
    expect(result.current.sessionDuration).toBeNull();
  });

  it('ignores a system clock jump when deciding to auto-end', async () => {
    const { result } = renderHook(() => useBreathTimer());

    act(() => {
      result.current.startSession(5);
    });
    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });

    // NTP correction / timezone change: Date leaps an hour, the monotonic
    // clock does not, so the session must keep running.
    act(() => {
      vi.setSystemTime(new Date('2026-07-16T13:00:00.000Z'));
    });
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.isRunning).toBe(true);
    expect(result.current.sessionDuration).toBe(5);
  });

  it('startSession(null) is a no-op', () => {
    const { result } = renderHook(() => useBreathTimer());

    act(() => {
      result.current.startSession(null);
    });

    expect(result.current.isRunning).toBe(false);
    expect(result.current.sessionDuration).toBeNull();
  });

  it('getPhaseSnapshot reads the live timeline between renders', async () => {
    const { result } = renderHook(() => useBreathTimer());

    act(() => {
      result.current.startSession(10);
    });
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });

    const snap = result.current.getPhaseSnapshot();
    expect(snap.phase).toBe('hold1');
    expect(snap.phaseElapsedSec).toBeCloseTo(1, 1);
    expect(snap.phaseDurationSec).toBe(4);

    // Frozen while paused.
    act(() => {
      result.current.toggleFree();
    });
    const paused = result.current.getPhaseSnapshot();
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.getPhaseSnapshot().phaseElapsedSec).toBe(paused.phaseElapsedSec);
  });

  it('endSession stops the timer but preserves breaths and phase', async () => {
    const { result } = renderHook(() => useBreathTimer());

    act(() => {
      result.current.startSession(10);
    });

    await act(async () => {
      vi.advanceTimersByTime(16_050);
    });
    await waitFor(() => expect(result.current.totalBreaths).toBe(1));
    await waitFor(() => expect(result.current.currentPhase).toBe('inhale'));

    const breathsBefore = result.current.totalBreaths;
    const phaseBefore = result.current.currentPhase;

    act(() => {
      result.current.endSession();
    });

    expect(result.current.isRunning).toBe(false);
    expect(result.current.sessionDuration).toBeNull();
    expect(result.current.totalBreaths).toBe(breathsBefore);
    expect(result.current.currentPhase).toBe(phaseBefore);
  });

  it('free-form practice never auto-ends after a long run', async () => {
    const { result } = renderHook(() => useBreathTimer());

    act(() => {
      result.current.toggleFree();
    });

    await act(async () => {
      vi.advanceTimersByTime(10 * 60_000);
    });

    expect(result.current.isRunning).toBe(true);
    expect(result.current.sessionDuration).toBeNull();
  });

  it('matches the analytical breath count over ten minutes of 1s phases', async () => {
    const { result } = renderHook(() => useBreathTimer());

    act(() => {
      result.current.updateSettings({ inhale: 1, hold1: 1, exhale: 1, hold2: 1 });
    });
    act(() => {
      result.current.startSession(15);
    });

    // One frame of slack: the rAF grid is not aligned to the session anchor.
    await act(async () => {
      vi.advanceTimersByTime(10 * 60_000 + 17);
    });

    // 600s / 4s per cycle = 150 breaths.
    await waitFor(() => expect(result.current.totalBreaths).toBe(150));
    expect(result.current.isRunning).toBe(true);
  });
});
