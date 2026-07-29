import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useBreathTimer } from '../useBreathTimer';

describe('useBreathTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'requestAnimationFrame'] });
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

  it('remaps wall-clock elapsed onto new tct when settings change mid-session', async () => {
    // Current behavior: continuous elapsed % newTct (not preserve-progress rebase).
    // A preserve-progress fix would be a follow-up; this pins the modulus jump.
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
});
