import { useState, useEffect, useCallback, useRef } from 'react';

export type Phase = 'inhale' | 'hold1' | 'exhale' | 'hold2';

const basePhaseDurations: Record<Phase, number> = {
  inhale: 4,
  hold1: 4,
  exhale: 6,
  hold2: 2,
};

export function useSacredBreathTimer(initialStrengthLevel: number = 0) {
  const [phase, setPhase] = useState<Phase>('inhale');
  const [phaseProgress, setPhaseProgress] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [countdown, setCountdown] = useState(basePhaseDurations.inhale);
  const [isRunning, setIsRunning] = useState(false);
  const [strengthLevel, setStrengthLevel] = useState(initialStrengthLevel);

  const startTimeRef = useRef<number>(0);
  const phaseStartTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  const phases: Phase[] = ['inhale', 'hold1', 'exhale', 'hold2'];

  const getPhaseDuration = useCallback((currentPhase: Phase, currentCycle: number, currentStrength: number): number => {
    let duration = basePhaseDurations[currentPhase];

    // Exact same progression logic as your original GLSL
    if (currentStrength === 0) { // light
      if (currentCycle > 16) duration = Math.max(duration, 7);
    } else if (currentStrength === 1) { // medium
      if (currentCycle > 31) duration = Math.max(duration, 8);
    } else { // strong
      if (currentCycle > 31) duration = Math.max(duration, 8);
      if (currentCycle > 61) duration = Math.max(duration, 10);
    }

    return duration;
  }, []);

  const tick = useCallback(() => {
    if (!isRunning) return;

    const now = performance.now();
    const currentDuration = getPhaseDuration(phase, cycle, strengthLevel);
    const elapsedInPhase = (now - phaseStartTimeRef.current) / 1000;
    let newProgress = Math.min(elapsedInPhase / currentDuration, 1.0);

    setPhaseProgress(newProgress);
    setCountdown(Math.max(0, Math.ceil(currentDuration - elapsedInPhase)));

    if (elapsedInPhase >= currentDuration) {
      const nextPhaseIndex = (phases.indexOf(phase) + 1) % 4;
      const nextPhase = phases[nextPhaseIndex];

      setPhase(nextPhase);
      phaseStartTimeRef.current = now;

      if (nextPhaseIndex === 0) setCycle(prev => prev + 1);

      setPhaseProgress(0);
    }

    animationFrameRef.current = requestAnimationFrame(tick);
  }, [isRunning, phase, cycle, strengthLevel, getPhaseDuration]);

  const start = useCallback(() => {
    if (isRunning) return;
    const now = performance.now();
    setIsRunning(true);
    startTimeRef.current = now;
    phaseStartTimeRef.current = now;
  }, [isRunning]);

  const pause = useCallback(() => {
    setIsRunning(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    pause();
    setPhase('inhale');
    setCycle(0);
    setPhaseProgress(0);
    setCountdown(basePhaseDurations.inhale);
    phaseStartTimeRef.current = 0;
  }, [pause]);

  const changeStrengthLevel = useCallback((newLevel: number) => {
    setStrengthLevel(newLevel);
    // optional: reset() if you want to restart on level change
  }, []);

  const getUniforms = useCallback(() => ({
    time: performance.now() / 1000,
    phase: phases.indexOf(phase),
    phaseProgress,
    cycle,
    strengthLevel,
    intensity: phase === 'inhale' ? phaseProgress * 1.2 : (phase === 'exhale' ? 1 - phaseProgress : 0.4),
  }), [phase, phaseProgress, cycle, strengthLevel]);

  useEffect(() => {
    if (isRunning) {
      animationFrameRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isRunning, tick]);

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
    changeStrengthLevel,
    getUniforms,
  };
}
