'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

export type Phase = 'inhale' | 'hold1' | 'exhale' | 'hold2';

export interface Durations {
  inhale: number;
  hold1: number;
  exhale: number;
  hold2: number;
}

export const DEFAULT_DURATIONS: Durations = { inhale: 4, hold1: 4, exhale: 6, hold2: 2 };

export interface BreathingTimerState {
  isRunning: boolean;
  currentPhase: Phase;
  phaseProgress: number;      // 0–1 inside current phase
  globalProgress: number;     // 0–1 for full cycle
  cycleProgress: number;      // 0–1 for current cycle position
  timeLeftInPhase: number;    // seconds remaining
  elapsed: number;            // total elapsed ms
  cycleCount: number;         // completed cycles
}

export interface BreathingTimerActions {
  start: () => void;
  pause: () => void;
  reset: () => void;
  setDurations: (durations: Durations) => void;
}

export const useBreathingTimer = (
  initialDurations: Durations = DEFAULT_DURATIONS
): BreathingTimerState & BreathingTimerActions => {
  const [durations, setDurationsState] = useState<Durations>(initialDurations);
  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);

  const cycle = useMemo(() => [durations.inhale, durations.hold1, durations.exhale, durations.hold2], [durations]);
  const totalCycle = useMemo(() => cycle.reduce((a, b) => a + b, 0), [cycle]);
  const phases: Phase[] = ['inhale', 'hold1', 'exhale', 'hold2'];

  const tick = useCallback(() => {
    if (!isRunning) return;
    const now = Date.now();
    const newElapsed = now - startTime;
    setElapsed(newElapsed);

    const elapsedSeconds = newElapsed / 1000;
    const currentCycleTime = elapsedSeconds % totalCycle;
    
    // Calculate completed cycles
    const completedCycles = Math.floor(elapsedSeconds / totalCycle);
    if (completedCycles !== cycleCount) {
      setCycleCount(completedCycles);
    }

    // Find current phase
    let accum = 0;
    for (let i = 0; i < cycle.length; i++) {
      accum += cycle[i];
      if (currentCycleTime < accum) {
        if (i !== currentPhaseIndex) setCurrentPhaseIndex(i);
        break;
      }
    }
  }, [isRunning, startTime, totalCycle, cycle, currentPhaseIndex, cycleCount]);

  useEffect(() => {
    let raf: number;
    const loop = () => {
      tick();
      raf = requestAnimationFrame(loop);
    };
    if (isRunning) raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [tick, isRunning]);

  // Calculate derived values
  const elapsedSeconds = elapsed / 1000;
  const currentCycleTime = elapsedSeconds % totalCycle;
  const globalProgress = (elapsedSeconds % totalCycle) / totalCycle;
  const cycleProgress = globalProgress;

  const currentPhase = phases[currentPhaseIndex];
  const phaseStart = cycle.slice(0, currentPhaseIndex).reduce((a, b) => a + b, 0);
  const phaseProgress = Math.min(1, Math.max(0, (currentCycleTime - phaseStart) / cycle[currentPhaseIndex]));
  const timeLeftInPhase = Math.ceil(cycle[currentPhaseIndex] - (currentCycleTime - phaseStart));

  const start = useCallback(() => {
    if (!isRunning) {
      setIsRunning(true);
      setStartTime(Date.now() - elapsed);
    }
  }, [isRunning, elapsed]);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    setIsRunning(false);
    setElapsed(0);
    setCurrentPhaseIndex(0);
    setCycleCount(0);
  }, []);

  const setDurations = useCallback((newDurations: Durations) => {
    setDurationsState(newDurations);
  }, []);

  return {
    isRunning,
    currentPhase,
    phaseProgress,
    globalProgress,
    cycleProgress,
    timeLeftInPhase,
    elapsed,
    cycleCount,
    start,
    pause,
    reset,
    setDurations,
  };
};

export default useBreathingTimer;
