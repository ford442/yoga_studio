'use client';

import { useEffect, useRef, useState } from 'react';
import type { SessionDuration } from './useBreathTimer';
import type { CompletionScreenProps } from '../components/CompletionScreen';
import { SESSION_MODES } from '../data/sessionModes';
import { getProgramById, getNextSessionDay, resolveProgramSessionTechnique } from '../data/programs';
import { NEXT_STEP_BY_MODE, DEFAULT_NEXT_STEP } from '../data/onboarding';
import type { SessionMode } from '../types/sessionMode';
import type { ActiveProgramProgress } from '../types/program';

export type ActiveProgramSession = { programId: string; dayIndex: number };
export type NextProgramSession = NonNullable<CompletionScreenProps['nextProgramSession']>;
export type CompletionMeta = {
  isFirstSession: boolean;
  modeId: string;
  modeLabel: string;
  modeEmoji: string;
};

interface UseSessionCompletionOptions {
  isRunning: boolean;
  sessionDuration: SessionDuration;
  totalBreaths: number;
  selectedMode: SessionMode;
  activeProgramSession: ActiveProgramSession | null;
  clearActiveProgramSession: () => void;
  clearBeginnerSession: () => void;
  programProgress: ActiveProgramProgress | null;
  completeDay: (dayIndex: number) => void;
  onboardingHasLoaded: boolean;
  hasCompletedFirstSession: boolean;
  markFirstSessionComplete: () => void;
  startMode: (mode: SessionMode, duration: 5) => void;
}

/** Detects timed-session completion, computes the completion overlay's data, and drives its handlers. */
export function useSessionCompletion({
  isRunning,
  sessionDuration,
  totalBreaths,
  selectedMode,
  activeProgramSession,
  clearActiveProgramSession,
  clearBeginnerSession,
  programProgress,
  completeDay,
  onboardingHasLoaded,
  hasCompletedFirstSession,
  markFirstSessionComplete,
  startMode,
}: UseSessionCompletionOptions) {
  const [showCompletion, setShowCompletion] = useState(false);
  const [completedInfo, setCompletedInfo] = useState({ minutes: 5, breaths: 0 });
  const [completionMeta, setCompletionMeta] = useState<CompletionMeta | null>(null);
  const [nextProgramSession, setNextProgramSession] = useState<NextProgramSession | null>(null);
  const prevSessionDurationRef = useRef<SessionDuration>(null);

  // Show completion screen when a timed session ends (use prev ref because
  // endSession() inside the timer hook nulls sessionDuration on the same update).
  useEffect(() => {
    if (prevSessionDurationRef.current !== null && !isRunning && totalBreaths > 0) {
      const isFirstSession = onboardingHasLoaded && !hasCompletedFirstSession;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCompletedInfo({
        minutes: prevSessionDurationRef.current || 5,
        breaths: totalBreaths,
      });
      setCompletionMeta({
        isFirstSession,
        modeId: selectedMode.id,
        modeLabel: selectedMode.label,
        modeEmoji: selectedMode.emoji,
      });

      // Mark active program day complete and compute the next scheduled session.
      if (activeProgramSession) {
        const { programId, dayIndex } = activeProgramSession;
        completeDay(dayIndex);
        const program = getProgramById(programId);
        if (program) {
          const updatedProgress = {
            ...(programProgress ?? { programId, startDate: new Date().toISOString().split('T')[0], completedDays: [] }),
            completedDays: [...(programProgress?.completedDays ?? []), dayIndex],
          };
          const nextDay = getNextSessionDay(program, updatedProgress);
          if (nextDay) {
            const nextTechnique = resolveProgramSessionTechnique(nextDay, SESSION_MODES);
            setNextProgramSession({
              programLabel: program.label,
              dayIndex: nextDay.dayIndex,
              techniqueLabel: nextTechnique.label,
              techniqueEmoji: nextTechnique.emoji,
              duration: nextDay.durationMinutes,
              note: nextDay.note,
            });
          } else {
            setNextProgramSession(null);
          }
        }
        clearActiveProgramSession();
      } else {
        setNextProgramSession(null);
      }

      setShowCompletion(true);
      clearBeginnerSession();
    }
    prevSessionDurationRef.current = sessionDuration;
  }, [
    isRunning,
    sessionDuration,
    totalBreaths,
    onboardingHasLoaded,
    hasCompletedFirstSession,
    selectedMode,
    activeProgramSession,
    completeDay,
    programProgress,
    clearActiveProgramSession,
    clearBeginnerSession,
  ]);

  const nextStepSuggestion = completionMeta
    ? NEXT_STEP_BY_MODE[completionMeta.modeId] ?? DEFAULT_NEXT_STEP
    : DEFAULT_NEXT_STEP;

  const handleCompletionClose = () => {
    if (completionMeta?.isFirstSession) {
      markFirstSessionComplete();
    }
    setShowCompletion(false);
    setCompletionMeta(null);
    setNextProgramSession(null);
  };

  const handleTryNextMode = () => {
    const next = NEXT_STEP_BY_MODE[completionMeta?.modeId ?? ''] ?? DEFAULT_NEXT_STEP;
    const mode = SESSION_MODES.find((entry) => entry.id === next.modeId);
    if (!mode) {
      handleCompletionClose();
      return;
    }
    setShowCompletion(false);
    setCompletionMeta(null);
    setNextProgramSession(null);
    if (completionMeta?.isFirstSession) {
      markFirstSessionComplete();
    }
    startMode(mode, 5);
  };

  return {
    showCompletion,
    completedInfo,
    completionMeta,
    nextProgramSession,
    nextStepSuggestion,
    handleCompletionClose,
    handleTryNextMode,
  };
}
