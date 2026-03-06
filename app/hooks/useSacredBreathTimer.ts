'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

type Phase = 'inhale' | 'hold1' | 'exhale' | 'hold2';

const baseDurations: Record<Phase, number> = {
  inhale: 4,
  hold1: 4,
  exhale: 6,
  hold2: 2,
};

export function useSacredBreathTimer(initialStrength: number = 0) {
  const [phase, setPhase] = useState<Phase>('inhale');
  const [phaseProgress, setPhaseProgress] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [countdown, setCountdown] = useState(baseDurations.inhale);
  const [isRunning, setIsRunning] = useState(false);
  const [strengthLevel, setStrengthLevel] = useState(initialStrength);

  const startTimeRef = useRef(performance.now());
  const phaseStartRef = useRef(performance.now());
  const rafRef = useRef<number | null>(null);

  const phases: Phase[] = ['inhale', 'hold1', 'exhale', 'hold2'];

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

  const tick = useCallback(() => {
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

    rafRef.current = requestAnimationFrame(tick);
  }, [isRunning, phase, cycle, strengthLevel, getDuration]);

  useEffect(() => {
    if (isRunning) rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [tick, isRunning]);

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

  const getUniforms = () => ({
    time: performance.now() / 1000,
    phase: phases.indexOf(phase),
    phaseProgress,
    cycle,
    strengthLevel,
    intensity: phase === 'inhale' ? phaseProgress : phase === 'exhale' ? 1 - phaseProgress : 0.3,
  });

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
  };
}
