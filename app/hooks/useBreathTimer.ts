import { useState, useEffect, useCallback, useRef } from 'react';

export type BreathPhase = 'inhale' | 'hold1' | 'exhale' | 'hold2';

export interface BreathSettings {
  inhale: number;
  hold1: number;
  exhale: number;
  hold2: number;
}

export type SessionDuration = 5 | 10 | 15 | null;

const defaultSettings: BreathSettings = { inhale: 4, hold1: 4, exhale: 6, hold2: 2 };

export const useBreathTimer = () => {
  const [settings, setSettings] = useState<BreathSettings>(defaultSettings);
  const [breathPhase, setBreathPhase] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<BreathPhase>('inhale');
  const [sessionDuration, setSessionDuration] = useState<SessionDuration>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [totalBreaths, setTotalBreaths] = useState(0);

  // Refs for rAF loop (avoid effect re-runs on every frame)
  const settingsRef = useRef(settings);
  const sessionDurationRef = useRef(sessionDuration);
  const sessionStartTimeRef = useRef(sessionStartTime);
  const prevBreathPhaseRef = useRef(0);
  const isRunningRef = useRef(isRunning);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { sessionDurationRef.current = sessionDuration; }, [sessionDuration]);
  useEffect(() => { sessionStartTimeRef.current = sessionStartTime; }, [sessionStartTime]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);

  const startSession = (minutes: SessionDuration) => {
    setSessionDuration(minutes);
    setSessionStartTime(Date.now());
    setTotalBreaths(0);
    setIsRunning(true);
    setBreathPhase(0);
    setCurrentPhase('inhale');
    prevBreathPhaseRef.current = 0;
  };

  const endSession = useCallback(() => {
    setIsRunning(false);
    setSessionDuration(null);
    setSessionStartTime(null);
  }, []);

  useEffect(() => {
    if (!isRunning) return;

    let raf: number;
    const startTime = Date.now();

    const tick = () => {
      if (!isRunningRef.current) return;

      const elapsed = (Date.now() - startTime) / 1000;
      const tct = settingsRef.current.inhale + settingsRef.current.hold1 + settingsRef.current.exhale + settingsRef.current.hold2;
      const cycleProgress = (elapsed % tct) / tct;
      setBreathPhase(cycleProgress);

      // Phase label
      const phaseTime = elapsed % tct;
      let newPhase: BreathPhase = 'inhale';
      const s = settingsRef.current;
      if (phaseTime < s.inhale) newPhase = 'inhale';
      else if (phaseTime < s.inhale + s.hold1) newPhase = 'hold1';
      else if (phaseTime < s.inhale + s.hold1 + s.exhale) newPhase = 'exhale';
      else newPhase = 'hold2';

      setCurrentPhase(newPhase);

      // Count completed breaths
      if (cycleProgress < 0.05 && prevBreathPhaseRef.current > 0.95) {
        setTotalBreaths(b => b + 1);
      }
      prevBreathPhaseRef.current = cycleProgress;

      // Auto-end session
      const sd = sessionDurationRef.current;
      const sst = sessionStartTimeRef.current;
      if (sd && sst) {
        const sessionElapsed = (Date.now() - sst) / 1000 / 60;
        if (sessionElapsed >= sd) {
          endSession();
          return;
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isRunning, endSession]);

  const toggleFree = () => {
    setSessionDuration(null);
    setSessionStartTime(null);
    setIsRunning(v => !v);
  };

  const reset = () => {
    setIsRunning(false);
    setBreathPhase(0);
    setTotalBreaths(0);
    setSessionDuration(null);
    setSessionStartTime(null);
    setCurrentPhase('inhale');
    prevBreathPhaseRef.current = 0;
  };

  const updateSettings = (newSettings: Partial<BreathSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  return {
    breathPhase,
    isRunning,
    currentPhase,
    settings,
    sessionDuration,
    totalBreaths,
    startSession,
    toggleFree,
    reset,
    updateSettings,
    endSession,
  };
};
