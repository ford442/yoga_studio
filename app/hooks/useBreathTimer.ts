import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  buildPhaseSchedule,
  countCompletedCycles,
  resolvePhaseAt,
  type BreathPhase,
  type BreathSchedule,
  type BreathSettings,
  type PhaseSnapshot,
} from '../lib/breathSchedule';

export type { BreathPhase, BreathSettings, BreathSchedule, PhaseSnapshot };

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
  /** Position on the breath timeline (ms since origin) where this segment began. */
  startElapsedMs: number;
  startBreaths: number;
  countedBreaths: number;
  scheduledDurationSec?: number;
}

/** Live timeline values published to React once per frame. */
export interface BreathTick {
  breathPhase: number;
  currentPhase: BreathPhase;
  phaseProgress: number;
  phaseElapsedSec: number;
  phaseDurationSec: number;
  remaining: number;
  phaseOrdinal: number;
  /** Monotonic timestamp (same origin as `performance.now()`) of the next phase boundary. */
  nextPhaseAtMs: number;
  nextPhase: BreathPhase;
}

const defaultSettings: BreathSettings = { inhale: 4, hold1: 4, exhale: 6, hold2: 2 };

/**
 * Monotonic clock. `performance.now()` is immune to system-clock adjustments,
 * which `Date.now()` is not; both are faked together by the test clocks.
 */
export const monotonicNow = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

const idleTick = (schedule: BreathSchedule): BreathTick => {
  const snap = resolvePhaseAt(schedule, 0);
  return {
    breathPhase: 0,
    currentPhase: snap.phase,
    phaseProgress: 0,
    phaseElapsedSec: 0,
    phaseDurationSec: snap.phaseDurationSec,
    remaining: snap.phaseDurationSec,
    phaseOrdinal: 0,
    nextPhaseAtMs: 0,
    nextPhase: snap.nextPhase,
  };
};

const tickFromSnapshot = (snap: PhaseSnapshot, anchorMs: number): BreathTick => ({
  breathPhase: snap.cycleProgress,
  currentPhase: snap.phase,
  phaseProgress: snap.phaseProgress,
  phaseElapsedSec: snap.phaseElapsedSec,
  phaseDurationSec: snap.phaseDurationSec,
  remaining: snap.remainingSec,
  phaseOrdinal: snap.phaseOrdinal,
  nextPhaseAtMs: anchorMs + snap.nextPhaseStartMs,
  nextPhase: snap.nextPhase,
});

export const useBreathTimer = () => {
  const [settings, setSettings] = useState<BreathSettings>(defaultSettings);
  const schedule = useMemo(() => buildPhaseSchedule(settings), [settings]);

  const [tick, setTick] = useState<BreathTick>(() => idleTick(buildPhaseSchedule(defaultSettings)));
  const [isRunning, setIsRunning] = useState(false);
  const [sessionDuration, setSessionDuration] = useState<SessionDuration>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [totalBreaths, setTotalBreaths] = useState(0);
  const [completedSegment, setCompletedSegment] = useState<CompletedTimerSegment | null>(null);
  const [activeSegmentId, setActiveSegmentId] = useState(0);

  // Refs for the rAF loop (avoid effect re-runs on every frame).
  // `scheduleRef` mirrors `schedule`; the effect below keeps it in sync.
  const scheduleRef = useRef(schedule);
  const sessionDurationRef = useRef(sessionDuration);
  const isRunningRef = useRef(isRunning);
  const totalBreathsRef = useRef(0);
  const activeSegmentRef = useRef<ActiveTimerSegment | null>(null);
  const segmentIdRef = useRef(0);

  /**
   * Monotonic origin of the breath timeline: `elapsed = monotonicNow() - anchor`.
   * Pausing freezes the elapsed value; resuming rebases the anchor so sub-phase
   * position survives untouched.
   */
  const anchorRef = useRef(0);
  const frozenElapsedRef = useRef(0);
  /** Monotonic deadline for an auto-ending timed session (null = free practice). */
  const sessionEndAtRef = useRef<number | null>(null);

  useEffect(() => {
    scheduleRef.current = schedule;
    if (isRunningRef.current) return;
    // Re-publish so a paused UI immediately reflects the new phase lengths;
    // while running the rAF loop picks the new schedule up on the next frame.
    setTick(tickFromSnapshot(resolvePhaseAt(schedule, frozenElapsedRef.current), anchorRef.current));
  }, [schedule]);

  const elapsedMs = useCallback(
    () => (isRunningRef.current ? monotonicNow() - anchorRef.current : frozenElapsedRef.current),
    [],
  );

  /**
   * Sample-accurate timeline read for consumers that run their own frame loop
   * (instructor video, audio scheduling) and must not inherit React's latency.
   */
  const getPhaseSnapshot = useCallback(
    (): PhaseSnapshot => resolvePhaseAt(scheduleRef.current, elapsedMs()),
    [elapsedMs],
  );

  const stopClock = useCallback(() => {
    frozenElapsedRef.current = elapsedMs();
    isRunningRef.current = false;
    sessionEndAtRef.current = null;
    setIsRunning(false);
  }, [elapsedMs]);

  /** Restarts the timeline at `fromElapsedMs` and runs it. */
  const startClock = useCallback((fromElapsedMs: number) => {
    frozenElapsedRef.current = fromElapsedMs;
    anchorRef.current = monotonicNow() - fromElapsedMs;
    isRunningRef.current = true;
    setIsRunning(true);
  }, []);

  const startSession = useCallback(
    (minutes: SessionDuration) => {
      if (minutes === null) return;
      const startedAt = Date.now();
      setSessionDuration(minutes);
      sessionDurationRef.current = minutes;
      setSessionStartTime(startedAt);
      setTotalBreaths(0);
      totalBreathsRef.current = 0;
      // A timed session always opens on a fresh inhale.
      startClock(0);
      sessionEndAtRef.current = anchorRef.current + minutes * 60_000;
      setTick(idleTick(schedule));
      activeSegmentRef.current = {
        id: ++segmentIdRef.current,
        kind: 'timed',
        startedAt,
        startElapsedMs: 0,
        startBreaths: 0,
        countedBreaths: 0,
        scheduledDurationSec: minutes * 60,
      };
      setActiveSegmentId(segmentIdRef.current);
    },
    [schedule, startClock],
  );

  const endSession = useCallback(() => {
    activeSegmentRef.current = null;
    stopClock();
    setSessionDuration(null);
    sessionDurationRef.current = null;
    setSessionStartTime(null);
  }, [stopClock]);

  useEffect(() => {
    if (!isRunning) return;

    let raf: number;

    const frame = () => {
      if (!isRunningRef.current) return;

      const now = monotonicNow();
      const elapsed = now - anchorRef.current;
      const sched = scheduleRef.current;

      setTick(tickFromSnapshot(resolvePhaseAt(sched, elapsed), anchorRef.current));

      // Count whole cycles from the schedule so a throttled or dropped frame
      // can never miss the narrow wrap boundary.
      const active = activeSegmentRef.current;
      if (active) {
        const completedCycles = countCompletedCycles(sched, elapsed - active.startElapsedMs);
        if (completedCycles > active.countedBreaths) {
          totalBreathsRef.current += completedCycles - active.countedBreaths;
          active.countedBreaths = completedCycles;
          setTotalBreaths(totalBreathsRef.current);
        }
      }

      const endAt = sessionEndAtRef.current;
      if (endAt !== null && now >= endAt) {
        const sd = sessionDurationRef.current;
        const breaths = active ? totalBreathsRef.current - active.startBreaths : 0;
        if (active?.kind === 'timed' && breaths > 0) {
          setCompletedSegment({
            id: active.id,
            kind: 'timed',
            endedAt: new Date().toISOString(),
            durationSec: active.scheduledDurationSec ?? (sd ?? 0) * 60,
            breaths,
          });
        }
        endSession();
        return;
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [isRunning, endSession]);

  const toggleFree = useCallback(() => {
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
      // Pause: the timeline freezes mid-phase and resumes from the same instant.
      stopClock();
    } else {
      startClock(frozenElapsedRef.current);
      activeSegmentRef.current = {
        id: ++segmentIdRef.current,
        kind: 'free',
        startedAt: now,
        startElapsedMs: frozenElapsedRef.current,
        startBreaths: totalBreathsRef.current,
        countedBreaths: 0,
      };
      setActiveSegmentId(segmentIdRef.current);
    }
    setSessionDuration(null);
    sessionDurationRef.current = null;
    setSessionStartTime(null);
  }, [startClock, stopClock]);

  const reset = useCallback(() => {
    activeSegmentRef.current = null;
    stopClock();
    frozenElapsedRef.current = 0;
    anchorRef.current = monotonicNow();
    setTick(idleTick(schedule));
    setTotalBreaths(0);
    totalBreathsRef.current = 0;
    setSessionDuration(null);
    sessionDurationRef.current = null;
    setSessionStartTime(null);
  }, [schedule, stopClock]);

  const updateSettings = useCallback((newSettings: Partial<BreathSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  return {
    breathPhase: tick.breathPhase,
    isRunning,
    currentPhase: tick.currentPhase,
    phaseProgress: tick.phaseProgress,
    phaseElapsedSec: tick.phaseElapsedSec,
    phaseDuration: tick.phaseDurationSec,
    remaining: tick.remaining,
    phaseOrdinal: tick.phaseOrdinal,
    nextPhaseAtMs: tick.nextPhaseAtMs,
    nextPhase: tick.nextPhase,
    totalCycle: schedule.totalCycleSec,
    schedule,
    getPhaseSnapshot,
    settings,
    sessionDuration,
    sessionStartTime,
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
