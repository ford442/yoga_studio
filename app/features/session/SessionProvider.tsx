'use client';

import React, { createContext, useContext, useMemo } from 'react';
import {
  useBreathTimer,
  type BreathPhase,
  type BreathSettings,
  type CompletedTimerSegment,
  type PhaseSnapshot,
  type SessionDuration,
} from '../../hooks/useBreathTimer';
import { computeIntensity } from './deriveSessionPhase';

interface SessionContextValue {
  breathPhase: number;
  isRunning: boolean;
  currentPhase: BreathPhase;
  settings: BreathSettings;
  sessionDuration: SessionDuration;
  totalBreaths: number;
  completedSegment: CompletedTimerSegment | null;
  activeSegmentId: number;
  totalCycle: number;
  phaseProgress: number;
  phaseElapsedSec: number;
  remaining: number;
  phaseDuration: number;
  phaseOrdinal: number;
  /** Monotonic timestamp of the upcoming phase boundary (for audio scheduling). */
  nextPhaseAtMs: number;
  nextPhase: BreathPhase;
  /** Reads the shared timeline at the calling instant, bypassing React latency. */
  getPhaseSnapshot: () => PhaseSnapshot;
  intensity: number;
  startSession: (minutes: SessionDuration) => void;
  toggleFree: () => void;
  reset: () => void;
  updateSettings: (next: Partial<BreathSettings>) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const {
    breathPhase,
    isRunning,
    currentPhase,
    settings,
    sessionDuration,
    totalBreaths,
    completedSegment,
    activeSegmentId,
    totalCycle,
    phaseProgress,
    phaseElapsedSec,
    phaseDuration,
    remaining,
    phaseOrdinal,
    nextPhaseAtMs,
    nextPhase,
    getPhaseSnapshot,
    startSession,
    toggleFree,
    reset,
    updateSettings,
  } = useBreathTimer();

  const intensity = useMemo(
    () => computeIntensity(currentPhase, phaseProgress),
    [currentPhase, phaseProgress],
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      breathPhase,
      isRunning,
      currentPhase,
      settings,
      sessionDuration,
      totalBreaths,
      completedSegment,
      activeSegmentId,
      totalCycle,
      phaseProgress,
      phaseElapsedSec,
      remaining,
      phaseDuration,
      phaseOrdinal,
      nextPhaseAtMs,
      nextPhase,
      getPhaseSnapshot,
      intensity,
      startSession,
      toggleFree,
      reset,
      updateSettings,
    }),
    [
      breathPhase,
      isRunning,
      currentPhase,
      settings,
      sessionDuration,
      totalBreaths,
      completedSegment,
      activeSegmentId,
      totalCycle,
      phaseProgress,
      phaseElapsedSec,
      remaining,
      phaseDuration,
      phaseOrdinal,
      nextPhaseAtMs,
      nextPhase,
      getPhaseSnapshot,
      intensity,
      startSession,
      toggleFree,
      reset,
      updateSettings,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
