import { useState, useEffect, useCallback, useRef } from 'react';

export type BreathPhase = 'inhale' | 'hold1' | 'exhale' | 'hold2';

export interface BreathSettings {
  inhale: number;
  hold1: number;
  exhale: number;
  hold2: number;
}

export type SessionDuration = 5 | 10 | 15 | null;

export interface CompletedTimerSegment {
  id: number;
  kind: 'timed' | 'free';
  endedAt: string;
  durationSec: number;
  breaths: number;
}

interface ActiveTimerSegment {
  id: number;
  kind: 'timed' | 'free';
  startedAt: number;
  startBreaths: number;
  countedBreaths: number;
  scheduledDurationSec?: number;
}

const defaultSettings: BreathSettings = { inhale: 4, hold1: 4, exhale: 6, hold2: 2 };

export const useBreathTimer = () => {
  const [settings, setSettings] = useState<BreathSettings>(defaultSettings);
  const [breathPhase, setBreathPhase] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<BreathPhase>('inhale');
  const [sessionDuration, setSessionDuration] = useState<SessionDuration>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [totalBreaths, setTotalBreaths] = useState(0);
  const [completedSegment, setCompletedSegment] = useState<CompletedTimerSegment | null>(null);
  const [activeSegmentId, setActiveSegmentId] = useState(0);

  // Refs for rAF loop (avoid effect re-runs on every frame)
  const settingsRef = useRef(settings);
  const sessionDurationRef = useRef(sessionDuration);
  const sessionStartTimeRef = useRef(sessionStartTime);
  const isRunningRef = useRef(isRunning);
  const totalBreathsRef = useRef(0);
  const activeSegmentRef = useRef<ActiveTimerSegment | null>(null);
  const segmentIdRef = useRef(0);

  const startSession = (minutes: SessionDuration) => {
    if (minutes === null) return;
    const startedAt = Date.now();
    setSessionDuration(minutes);
    sessionDurationRef.current = minutes;
    setSessionStartTime(startedAt);
    sessionStartTimeRef.current = startedAt;
    setTotalBreaths(0);
    totalBreathsRef.current = 0;
    setIsRunning(true);
    isRunningRef.current = true;
    setBreathPhase(0);
    setCurrentPhase('inhale');
    activeSegmentRef.current = {
      id: ++segmentIdRef.current,
      kind: 'timed',
      startedAt,
      startBreaths: 0,
      countedBreaths: 0,
      scheduledDurationSec: minutes * 60,
    };
    setActiveSegmentId(segmentIdRef.current);
  };

  const endSession = useCallback(() => {
    activeSegmentRef.current = null;
    isRunningRef.current = false;
    setIsRunning(false);
    setSessionDuration(null);
    sessionDurationRef.current = null;
    setSessionStartTime(null);
    sessionStartTimeRef.current = null;
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

      // Count every full elapsed cycle, even when a throttled/dropped frame skips
      // the narrow visual wrap boundary.
      const active = activeSegmentRef.current;
      const completedCycles = active
        ? Math.floor(Math.max(0, (Date.now() - active.startedAt) / 1000) / tct)
        : 0;
      if (active && completedCycles > active.countedBreaths) {
        totalBreathsRef.current += completedCycles - active.countedBreaths;
        active.countedBreaths = completedCycles;
        setTotalBreaths(totalBreathsRef.current);
      }

      // Auto-end session
      const sd = sessionDurationRef.current;
      const sst = sessionStartTimeRef.current;
      if (sd && sst) {
        const sessionElapsed = (Date.now() - sst) / 1000 / 60;
        if (sessionElapsed >= sd) {
          const active = activeSegmentRef.current;
          const breaths = active ? totalBreathsRef.current - active.startBreaths : 0;
          if (active?.kind === 'timed' && breaths > 0) {
            setCompletedSegment({
              id: active.id,
              kind: 'timed',
              endedAt: new Date().toISOString(),
              durationSec: active.scheduledDurationSec ?? sd * 60,
              breaths,
            });
          }
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
    const now = Date.now();
    if (isRunningRef.current) {
      const active = activeSegmentRef.current;
      const breaths = active ? totalBreathsRef.current - active.startBreaths : 0;
      if (active?.kind === 'free' && breaths > 0) {
        setCompletedSegment({
          id: active.id,
          kind: 'free',
          endedAt: new Date(now).toISOString(),
          durationSec: Math.max(1, Math.floor((now - active.startedAt) / 1000)),
          breaths,
        });
      }
      activeSegmentRef.current = null;
      isRunningRef.current = false;
      setIsRunning(false);
    } else {
      activeSegmentRef.current = {
        id: ++segmentIdRef.current,
        kind: 'free',
        startedAt: now,
        startBreaths: totalBreathsRef.current,
        countedBreaths: 0,
      };
      setActiveSegmentId(segmentIdRef.current);
      isRunningRef.current = true;
      setIsRunning(true);
    }
    setSessionDuration(null);
    sessionDurationRef.current = null;
    setSessionStartTime(null);
    sessionStartTimeRef.current = null;
  };

  const reset = () => {
    activeSegmentRef.current = null;
    isRunningRef.current = false;
    setIsRunning(false);
    setBreathPhase(0);
    setTotalBreaths(0);
    totalBreathsRef.current = 0;
    setSessionDuration(null);
    sessionDurationRef.current = null;
    setSessionStartTime(null);
    sessionStartTimeRef.current = null;
    setCurrentPhase('inhale');
  };

  const updateSettings = (newSettings: Partial<BreathSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...newSettings };
      settingsRef.current = next;
      return next;
    });
  };

  return {
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
    endSession,
  };
};
