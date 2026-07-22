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
});
