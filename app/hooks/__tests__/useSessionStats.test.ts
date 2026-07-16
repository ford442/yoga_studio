import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSessionStats } from '../useSessionStats';

const STORAGE_KEY = 'sacred-breath-stats';

describe('useSessionStats', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-16T12:00:00.000Z'));
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns default stats when localStorage is empty', async () => {
    const { result } = renderHook(() => useSessionStats());

    await waitFor(() => expect(result.current.stats.lastPracticeDate).toBe('2026-07-16'));

    expect(result.current.stats.todayMinutes).toBe(0);
    expect(result.current.stats.todayBreaths).toBe(0);
    expect(result.current.stats.currentStreak).toBe(0);
  });

  it('falls back to defaults on a corrupt payload', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem(STORAGE_KEY, 'not valid json');

    const { result } = renderHook(() => useSessionStats());

    await waitFor(() => expect(result.current.stats.todayMinutes).toBe(0));

    expect(result.current.stats.todayBreaths).toBe(0);
    expect(result.current.stats.currentStreak).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith('Invalid sacred-breath-stats localStorage payload');

    warnSpy.mockRestore();
  });

  it('loads today stats unchanged when the stored date matches today', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        todayMinutes: 12,
        todayBreaths: 30,
        currentStreak: 5,
        lastPracticeDate: '2026-07-16',
      })
    );

    const { result } = renderHook(() => useSessionStats());

    await waitFor(() => expect(result.current.stats.todayBreaths).toBe(30));

    expect(result.current.stats.todayMinutes).toBe(12);
    expect(result.current.stats.currentStreak).toBe(5);
  });

  it('resets daily counters and increments streak after a practice following yesterday', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        todayMinutes: 12,
        todayBreaths: 30,
        currentStreak: 5,
        lastPracticeDate: '2026-07-15',
      })
    );

    const { result } = renderHook(() => useSessionStats());

    await waitFor(() => expect(result.current.stats.lastPracticeDate).toBe('2026-07-15'));

    expect(result.current.stats.todayMinutes).toBe(0);
    expect(result.current.stats.todayBreaths).toBe(0);
    expect(result.current.stats.currentStreak).toBe(5);

    act(() => {
      result.current.addPracticeTime(120);
    });

    await waitFor(() => expect(result.current.stats.currentStreak).toBe(6));
    expect(result.current.stats.lastPracticeDate).toBe('2026-07-16');
    expect(result.current.stats.todayMinutes).toBe(2);
    expect(result.current.stats.todayBreaths).toBe(1);
  });

  it('resets daily counters and streak after a gap longer than one day', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        todayMinutes: 12,
        todayBreaths: 30,
        currentStreak: 5,
        lastPracticeDate: '2026-07-13',
      })
    );

    const { result } = renderHook(() => useSessionStats());

    await waitFor(() => expect(result.current.stats.lastPracticeDate).toBe('2026-07-13'));

    expect(result.current.stats.todayMinutes).toBe(0);
    expect(result.current.stats.todayBreaths).toBe(0);
    expect(result.current.stats.currentStreak).toBe(5);

    act(() => {
      result.current.addPracticeTime(60);
    });

    await waitFor(() => expect(result.current.stats.currentStreak).toBe(1));
    expect(result.current.stats.lastPracticeDate).toBe('2026-07-16');
    expect(result.current.stats.todayMinutes).toBe(1);
    expect(result.current.stats.todayBreaths).toBe(1);
  });

  it('does not increment streak more than once per day', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        todayMinutes: 1,
        todayBreaths: 1,
        currentStreak: 3,
        lastPracticeDate: '2026-07-16',
      })
    );

    const { result } = renderHook(() => useSessionStats());

    await waitFor(() => expect(result.current.stats.todayBreaths).toBe(1));

    act(() => {
      result.current.addPracticeTime(60);
    });
    await waitFor(() => expect(result.current.stats.todayBreaths).toBe(2));
    expect(result.current.stats.currentStreak).toBe(3);

    act(() => {
      result.current.addPracticeTime(60);
    });
    await waitFor(() => expect(result.current.stats.todayBreaths).toBe(3));
    expect(result.current.stats.currentStreak).toBe(3);
  });
});
