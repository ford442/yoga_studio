import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useSessionCompletion } from '../useSessionCompletion';
import { SESSION_MODES } from '../../data/sessionModes';
import type { SessionDuration } from '../useBreathTimer';

const mode = SESSION_MODES.find((m) => m.id === 'classic-mandala')!;

function setup(overrides: Partial<Parameters<typeof useSessionCompletion>[0]> = {}) {
  const clearActiveProgramSession = vi.fn();
  const clearBeginnerSession = vi.fn();
  const completeDay = vi.fn();
  const markFirstSessionComplete = vi.fn();
  const startMode = vi.fn();

  const initialProps = {
    isRunning: false,
    sessionDuration: null as SessionDuration,
    totalBreaths: 0,
    selectedMode: mode,
    activeProgramSession: null,
    clearActiveProgramSession,
    clearBeginnerSession,
    programProgress: null,
    completeDay,
    onboardingHasLoaded: true,
    hasCompletedFirstSession: false,
    markFirstSessionComplete,
    startMode,
    ...overrides,
  };

  const { result, rerender } = renderHook((props) => useSessionCompletion(props), {
    initialProps,
  });

  return { result, rerender, clearActiveProgramSession, clearBeginnerSession, completeDay, markFirstSessionComplete, startMode, initialProps };
}

describe('useSessionCompletion', () => {
  it('does not show completion while a session is still running', () => {
    const { result } = setup({ isRunning: true, sessionDuration: 5, totalBreaths: 3 });
    expect(result.current.showCompletion).toBe(false);
  });

  it('shows completion once a timed session transitions from running to stopped', () => {
    const { result, rerender, initialProps } = setup({ isRunning: true, sessionDuration: 5, totalBreaths: 0 });

    rerender({ ...initialProps, isRunning: true, sessionDuration: 5, totalBreaths: 4 });
    expect(result.current.showCompletion).toBe(false);

    rerender({ ...initialProps, isRunning: false, sessionDuration: null, totalBreaths: 4 });

    expect(result.current.showCompletion).toBe(true);
    expect(result.current.completedInfo).toEqual({ minutes: 5, breaths: 4 });
    expect(result.current.completionMeta).toMatchObject({
      isFirstSession: true,
      modeId: mode.id,
      modeLabel: mode.label,
    });
  });

  it('marks the first session complete and closes on handleCompletionClose', () => {
    const { result, rerender, initialProps, markFirstSessionComplete } = setup({
      isRunning: true,
      sessionDuration: 5,
      totalBreaths: 0,
    });
    rerender({ ...initialProps, isRunning: false, sessionDuration: null, totalBreaths: 4 });
    expect(result.current.showCompletion).toBe(true);

    act(() => {
      result.current.handleCompletionClose();
    });

    expect(markFirstSessionComplete).toHaveBeenCalledTimes(1);
    expect(result.current.showCompletion).toBe(false);
    expect(result.current.completionMeta).toBeNull();
  });

  it('completes the active program day and computes the next scheduled session', () => {
    const { result, rerender, initialProps, completeDay, clearActiveProgramSession } = setup({
      isRunning: true,
      sessionDuration: 5,
      totalBreaths: 0,
      activeProgramSession: { programId: 'beginner-calm-week', dayIndex: 0 },
      programProgress: { programId: 'beginner-calm-week', startDate: '2026-07-16', completedDays: [] },
    });

    rerender({
      ...initialProps,
      isRunning: false,
      sessionDuration: null,
      totalBreaths: 4,
      activeProgramSession: { programId: 'beginner-calm-week', dayIndex: 0 },
      programProgress: { programId: 'beginner-calm-week', startDate: '2026-07-16', completedDays: [] },
    });

    expect(completeDay).toHaveBeenCalledWith(0);
    expect(clearActiveProgramSession).toHaveBeenCalledTimes(1);
    expect(result.current.nextProgramSession).toMatchObject({
      programLabel: 'Beginner Calm Week',
      dayIndex: 1,
    });
  });

  it('handleTryNextMode starts the suggested next mode and clears completion state', () => {
    const { result, rerender, initialProps, startMode } = setup({
      isRunning: true,
      sessionDuration: 5,
      totalBreaths: 0,
    });
    rerender({ ...initialProps, isRunning: false, sessionDuration: null, totalBreaths: 4 });

    act(() => {
      result.current.handleTryNextMode();
    });

    expect(startMode).toHaveBeenCalledTimes(1);
    expect(startMode.mock.calls[0][1]).toBe(5);
    expect(result.current.showCompletion).toBe(false);
  });
});
