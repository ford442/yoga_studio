import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useActiveProgram } from '../useActiveProgram';

const STORAGE_KEY = 'sacred-breath-active-program';

describe('useActiveProgram', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-16T12:00:00.000Z'));
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns no active program when localStorage is empty', async () => {
    const { result } = renderHook(() => useActiveProgram());

    await waitFor(() => expect(result.current.hasLoaded).toBe(true));

    expect(result.current.activeProgramId).toBeNull();
    expect(result.current.progress).toBeNull();
  });

  it('selecting a program persists it to localStorage', async () => {
    const { result } = renderHook(() => useActiveProgram());
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));

    act(() => {
      result.current.selectProgram('beginner-calm-week');
    });

    await waitFor(() => expect(result.current.activeProgramId).toBe('beginner-calm-week'));
    expect(result.current.progress).toMatchObject({
      programId: 'beginner-calm-week',
      startDate: '2026-07-16',
      completedDays: [],
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.programId).toBe('beginner-calm-week');
  });

  it('completing a day adds it to completedDays with a timestamp', async () => {
    const { result } = renderHook(() => useActiveProgram());
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));

    act(() => {
      result.current.selectProgram('beginner-calm-week');
    });

    await waitFor(() => expect(result.current.activeProgramId).toBe('beginner-calm-week'));

    act(() => {
      result.current.completeDay(0);
    });

    await waitFor(() => expect(result.current.progress?.completedDays).toContain(0));
    expect(result.current.progress?.completedDays).toEqual([0]);
    expect(result.current.progress?.lastCompletedAt).toMatch(/^2026-07-16T/);
  });

  it('does not duplicate a completed day', async () => {
    const { result } = renderHook(() => useActiveProgram());
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));

    act(() => {
      result.current.selectProgram('beginner-calm-week');
    });
    await waitFor(() => expect(result.current.activeProgramId).toBe('beginner-calm-week'));

    act(() => {
      result.current.completeDay(0);
      result.current.completeDay(0);
    });

    await waitFor(() => expect(result.current.progress?.completedDays).toHaveLength(1));
  });

  it('abandoning a program clears state and localStorage', async () => {
    const { result } = renderHook(() => useActiveProgram());
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));

    act(() => {
      result.current.selectProgram('beginner-calm-week');
    });
    await waitFor(() => expect(result.current.activeProgramId).toBe('beginner-calm-week'));

    act(() => {
      result.current.abandonProgram();
    });

    await waitFor(() => expect(result.current.activeProgramId).toBeNull());
    expect(result.current.progress).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('resetting a program clears completed days but keeps the program id', async () => {
    const { result } = renderHook(() => useActiveProgram());
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));

    act(() => {
      result.current.selectProgram('beginner-calm-week');
    });
    await waitFor(() => expect(result.current.activeProgramId).toBe('beginner-calm-week'));

    act(() => {
      result.current.completeDay(0);
    });
    await waitFor(() => expect(result.current.progress?.completedDays).toHaveLength(1));

    act(() => {
      result.current.resetProgram();
    });

    await waitFor(() => expect(result.current.progress?.completedDays).toHaveLength(0));
    expect(result.current.activeProgramId).toBe('beginner-calm-week');
    expect(result.current.progress?.lastCompletedAt).toBeUndefined();
  });

  it('falls back to empty state on corrupt payload', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem(STORAGE_KEY, 'not valid json');

    const { result } = renderHook(() => useActiveProgram());
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));

    expect(result.current.activeProgramId).toBeNull();
    expect(result.current.progress).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('Invalid sacred-breath-active-program localStorage payload');

    warnSpy.mockRestore();
  });

  it('loads existing progress from localStorage', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        programId: 'focus-reset',
        startDate: '2026-07-15',
        completedDays: [0, 1],
        lastCompletedAt: '2026-07-16T10:00:00.000Z',
      }),
    );

    const { result } = renderHook(() => useActiveProgram());
    await waitFor(() => expect(result.current.activeProgramId).toBe('focus-reset'));

    expect(result.current.progress?.completedDays).toEqual([0, 1]);
    expect(result.current.progress?.lastCompletedAt).toBe('2026-07-16T10:00:00.000Z');
  });
});
