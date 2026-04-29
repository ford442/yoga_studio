'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

type Phase = 'inhale' | 'hold1' | 'exhale' | 'hold2';

const baseDurations: Record<Phase, number> = {
  inhale: 4,
  hold1: 4,
  exhale: 6,
  hold2: 2,
};

const phases: Phase[] = ['inhale', 'hold1', 'exhale', 'hold2'];

export function useSacredBreathTimer(initialStrength: number = 0) {
  const [phase, setPhase] = useState<Phase>('inhale');
  const [phaseProgress, setPhaseProgress] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [countdown, setCountdown] = useState(baseDurations.inhale);
  const [isRunning, setIsRunning] = useState(false);
  const [strengthLevel, setStrengthLevel] = useState(initialStrength);

  const startTimeRef = useRef(0);
  const phaseStartRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Initialize refs on mount (avoids impure performance.now() during render)
  useEffect(() => {
    const now = performance.now();
    startTimeRef.current = now;
    phaseStartRef.current = now;
  }, []);

  const getDuration = useCallback((p: Phase, c: number, s: number) => {
    let d = baseDurations[p];
    if (s === 0) { // light
      if (c > 16) d = Math.max(d, 7);
    } else if (s === 1) { // medium
      if (c > 31) d = Math.max(d, 8);
    } else { // strong
      if (c > 31) d = Math.max(d, 8);
      if (c > 61) d = Math.max(d, 10);
    }
    return d;
  }, []);

  // Store the latest tick closure in a ref so the rAF loop always calls the
  // most up-to-date version without a self-referential useCallback.
  const tickRef = useRef<() => void>(() => {});

  useEffect(() => {
    tickRef.current = () => {
      if (!isRunning) return;

      const now = performance.now();
      const dur = getDuration(phase, cycle, strengthLevel);
      const elapsed = (now - phaseStartRef.current) / 1000;
      const prog = Math.min(elapsed / dur, 1);

      setPhaseProgress(prog);
      setCountdown(Math.max(0, Math.ceil(dur - elapsed)));

      if (elapsed >= dur) {
        const nextIdx = (phases.indexOf(phase) + 1) % 4;
        const nextPhase = phases[nextIdx];
        setPhase(nextPhase);
        phaseStartRef.current = now;

        if (nextIdx === 0) setCycle(c => c + 1);

        setPhaseProgress(0);
        setCountdown(getDuration(nextPhase, cycle + (nextIdx === 0 ? 1 : 0), strengthLevel));
      }

      rafRef.current = requestAnimationFrame(() => tickRef.current());
    };
  }, [isRunning, phase, cycle, strengthLevel, getDuration]);

  useEffect(() => {
    if (isRunning) rafRef.current = requestAnimationFrame(() => tickRef.current());
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isRunning]);

  const start = () => {
    if (isRunning) return;
    const now = performance.now();
    startTimeRef.current = now;
    phaseStartRef.current = now;
    setIsRunning(true);
  };

  const pause = () => setIsRunning(false);

  const reset = () => {
    pause();
    setPhase('inhale');
    setCycle(0);
    setPhaseProgress(0);
    setCountdown(baseDurations.inhale);
  };

  const phaseIdx = phases.indexOf(phase);

  // Compute active chakra index (0–6) matching the original particle-compute logic.
  let activeChakra = 3; // heart default
  switch (phaseIdx) {
    case 0: // inhale — rising through chakras 0→5
      activeChakra = Math.min(5, Math.floor(phaseProgress * 6));
      break;
    case 1: // hold-in — crown
      activeChakra = 6;
      break;
    case 2: // exhale — descending through chakras 6→1
      activeChakra = Math.max(1, 6 - Math.floor(phaseProgress * 6));
      break;
    case 3: // hold-out — root
      activeChakra = 0;
      break;
  }

  const intensity = phase === 'inhale' ? phaseProgress : phase === 'exhale' ? 1 - phaseProgress : 0.3;
  const breathPhase = (phaseIdx + phaseProgress) / 4.0;

  const getUniforms = useCallback(() => {
    let secondaryChakra = -1;
    switch (phaseIdx) {
      case 0:
        secondaryChakra = Math.min(6, activeChakra + 1);
        break;
      case 2:
        secondaryChakra = activeChakra - 1;
        break;
    }
    return {
      time: performance.now() / 1000,
      phase: phaseIdx,
      phaseProgress,
      cycle,
      strengthLevel,
      intensity,
      activeChakra,
      secondaryChakra,
    };
  }, [phaseIdx, phaseProgress, cycle, strengthLevel, intensity, activeChakra]);

  return {
    phase,
    phaseProgress,
    cycle,
    countdown: Math.ceil(countdown),
    isRunning,
    strengthLevel,
    start,
    pause,
    reset,
    setStrengthLevel,
    getUniforms,
    activeChakra,
    intensity,
    breathPhase,
  };
}
