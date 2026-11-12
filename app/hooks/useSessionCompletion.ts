'use client';

import { useEffect, useRef, useState } from 'react';
import type { CompletedTimerSegment } from './useBreathTimer';
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

const DEFAULT_COMPLETED_INFO = { minutes: 5, breaths: 0 };

type Completion = {
  segmentId: number;
  info: { minutes: number; breaths: number };
  meta: CompletionMeta;
  nextProgramSession: NextProgramSession | null;
  /** Program day finished by this session, or null for a non-program session. */
  completedProgramDay: number | null;
};

function buildCompletion(
  segment: CompletedTimerSegment,
  ctx: {
    selectedMode: SessionMode;
    activeProgramSession: ActiveProgramSession | null;
    programProgress: ActiveProgramProgress | null;
    isFirstSession: boolean;
  },
): Completion {
  const { selectedMode, activeProgramSession, programProgress, isFirstSession } = ctx;
  let nextProgramSession: NextProgramSession | null = null;

  // Compute the next scheduled session as if the active program day were done.
  if (activeProgramSession) {
    const { programId, dayIndex } = activeProgramSession;
    const program = getProgramById(programId);
    if (program) {
      const updatedProgress = {
        ...(programProgress ?? { programId, startDate: new Date().toISOString().split('T')[0], completedDays: [] }),
        completedDays: [...(programProgress?.completedDays ?? []), dayIndex],
      };
      const nextDay = getNextSessionDay(program, updatedProgress);
      if (nextDay) {
        const nextTechnique = resolveProgramSessionTechnique(nextDay, SESSION_MODES);
        nextProgramSession = {
          programLabel: program.label,
          dayIndex: nextDay.dayIndex,
          techniqueLabel: nextTechnique.label,
          techniqueEmoji: nextTechnique.emoji,
          duration: nextDay.durationMinutes,
          note: nextDay.note,
        };
      }
    }
  }

  return {
    segmentId: segment.id,
    info: {
      minutes: Math.max(1, Math.round(segment.durationSec / 60)),
      breaths: segment.breaths,
    },
    meta: {
      isFirstSession,
      modeId: selectedMode.id,
      modeLabel: selectedMode.label,
      modeEmoji: selectedMode.emoji,
    },
    nextProgramSession,
    completedProgramDay: activeProgramSession ? activeProgramSession.dayIndex : null,
  };
}

interface UseSessionCompletionOptions {
  completedSegment: CompletedTimerSegment | null;
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
  completedSegment,
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
  // One state object holds everything the overlay shows. It is captured when the
  // timer's completion event first arrives (selectedMode / activeProgramSession
  // change right after), and cleared when the overlay closes.
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [handledSegmentId, setHandledSegmentId] = useState(0);
  const sideEffectsRunForRef = useRef(0);

  // Only the timer's explicit auto-completion event may finish a timed session.
  // Manual stops, resets, and replacements intentionally emit no event.
  // Derived while rendering (React's "adjust state on prop change" pattern):
  // everything computed here is pure, so no effect needs to call setState.
  if (completedSegment?.kind === 'timed' && completedSegment.id !== handledSegmentId) {
    setHandledSegmentId(completedSegment.id);
    setCompletion(buildCompletion(completedSegment, {
      selectedMode,
      activeProgramSession,
      programProgress,
      isFirstSession: onboardingHasLoaded && !hasCompletedFirstSession,
    }));
  }

  // Effects for the parent's state only: mark the program day done and clear the
  // finished session, exactly once per completion event.
  const completionSegmentId = completion?.segmentId ?? 0;
  const completedProgramDay = completion?.completedProgramDay ?? null;
  useEffect(() => {
    if (!completionSegmentId || sideEffectsRunForRef.current === completionSegmentId) return;
    sideEffectsRunForRef.current = completionSegmentId;
    if (completedProgramDay !== null) {
      completeDay(completedProgramDay);
      clearActiveProgramSession();
    }
    clearBeginnerSession();
  }, [completionSegmentId, completedProgramDay, completeDay, clearActiveProgramSession, clearBeginnerSession]);

  const showCompletion = completion !== null;
  const completedInfo = completion?.info ?? DEFAULT_COMPLETED_INFO;
  const completionMeta = completion?.meta ?? null;
  const nextProgramSession = completion?.nextProgramSession ?? null;

  const nextStepSuggestion = completionMeta
    ? NEXT_STEP_BY_MODE[completionMeta.modeId] ?? DEFAULT_NEXT_STEP
    : DEFAULT_NEXT_STEP;

  const handleCompletionClose = () => {
    if (completionMeta?.isFirstSession) {
      markFirstSessionComplete();
    }
    setCompletion(null);
  };

  const handleTryNextMode = () => {
    const next = NEXT_STEP_BY_MODE[completionMeta?.modeId ?? ''] ?? DEFAULT_NEXT_STEP;
    const mode = SESSION_MODES.find((entry) => entry.id === next.modeId);
    if (!mode) {
      handleCompletionClose();
      return;
    }
    setCompletion(null);
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
