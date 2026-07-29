'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useBreathTimer, type BreathPhase, type BreathSettings, type CompletedTimerSegment, type SessionDuration } from '../../hooks/useBreathTimer';
import { computeIntensity, computePhaseTiming } from './deriveSessionPhase';

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
  remaining: number;
  phaseDuration: number;
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
    startSession,
    toggleFree,
    reset,
    updateSettings,
  } = useBreathTimer();

  const { totalCycle, phaseProgress, remaining, phaseDuration } = useMemo(
    () => computePhaseTiming(breathPhase, currentPhase, settings),
    [breathPhase, currentPhase, settings],
  );

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
      remaining,
      phaseDuration,
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
      remaining,
      phaseDuration,
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
