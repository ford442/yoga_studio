'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { monotonicNow, type BreathPhase, type PhaseSnapshot } from './useBreathTimer';
import { getAudioBreathExpand, getThemeBaseFrequency } from '../utils/audioEasing';

interface UseBreathAudioProps {
  /** Reads the shared breath timeline at the calling instant. */
  getPhaseSnapshot: () => PhaseSnapshot;
  /** Monotonic timestamp of the upcoming phase boundary. */
  nextPhaseAtMs: number;
  /** Phase that begins at `nextPhaseAtMs`. */
  nextPhase: BreathPhase;
  /** Strictly increasing ordinal of the current phase; dedupes boundary scheduling. */
  phaseOrdinal: number;
  isRunning: boolean;
  themeIndex?: number;
}

const CHIME_FREQUENCIES: Record<BreathPhase, { freq: number; type: OscillatorType; duration: number }> = {
  inhale: { freq: 432, type: 'sine', duration: 1200 },
  hold1: { freq: 528, type: 'triangle', duration: 900 },
  exhale: { freq: 396, type: 'sine', duration: 1100 },
  hold2: { freq: 639, type: 'triangle', duration: 800 },
};

const MIN_CUTOFF = 300;
const MAX_CUTOFF = 1900;
const BASE_GAIN = 0.05;
const MAX_DYNAMIC_GAIN = 0.3;
const HOLD2_GAIN = 0.01;
const BINAURAL_OFFSET_DEFAULT = 4.5;
const BINAURAL_OFFSET_HOLD = 2;

export const useBreathAudio = ({
  getPhaseSnapshot,
  nextPhaseAtMs,
  nextPhase,
  phaseOrdinal,
  isRunning,
  themeIndex = 0,
}: UseBreathAudioProps) => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mainGainRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const oscLRef = useRef<OscillatorNode | null>(null);
  const oscRRef = useRef<OscillatorNode | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const muteRef = useRef(false);
  const isRunningRef = useRef(isRunning);
  const [isMuted, setIsMuted] = useState(false);

  /** Ordinal of the boundary chime already committed to the audio clock. */
  const scheduledOrdinalRef = useRef(-1);
  const scheduledChimesRef = useRef<OscillatorNode[]>([]);
  const snapshotRef = useRef(getPhaseSnapshot);
  const themeIndexRef = useRef(themeIndex);

  useEffect(() => {
    snapshotRef.current = getPhaseSnapshot;
  }, [getPhaseSnapshot]);

  useEffect(() => {
    themeIndexRef.current = themeIndex;
  }, [themeIndex]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioContextCtor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new (AudioContextCtor || AudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  /** Drops any chime committed to the audio clock but not yet heard. */
  const cancelScheduledChimes = useCallback(() => {
    for (const osc of scheduledChimesRef.current) {
      try {
        osc.stop();
      } catch {
        // already stopped or never started
      }
      osc.disconnect();
    }
    scheduledChimesRef.current = [];
    scheduledOrdinalRef.current = -1;
  }, []);

  /**
   * Books a chime on the AudioContext clock for the monotonic instant `atMs`.
   * Scheduling ahead of time removes the React-effect latency that made short
   * phases (1s test sliders) feel like the sound trailed the countdown.
   */
  const scheduleChime = useCallback(
    (phase: BreathPhase, atMs: number) => {
      if (muteRef.current || !isRunningRef.current) return;
      const ctx = getAudioContext();
      const { freq, duration, type } = CHIME_FREQUENCIES[phase];
      // Re-derive the offset each call so performance/audio clock skew cannot
      // accumulate across a long session.
      const startAt = ctx.currentTime + Math.max(0, (atMs - monotonicNow()) / 1000);
      const endAt = startAt + duration / 1000;

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(freq, startAt);
      oscillator.type = type;

      gain.gain.setValueAtTime(0.6, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, endAt);

      oscillator.start(startAt);
      oscillator.stop(endAt);

      scheduledChimesRef.current.push(oscillator);
      oscillator.onended = () => {
        scheduledChimesRef.current = scheduledChimesRef.current.filter((o) => o !== oscillator);
      };
    },
    [getAudioContext],
  );

  const teardownSoundscape = useCallback(() => {
    cancelScheduledChimes();
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    for (const osc of [oscLRef, oscRRef]) {
      if (osc.current) {
        try {
          osc.current.stop();
        } catch {
          // oscillator may already be stopped
        }
        osc.current.disconnect();
        osc.current = null;
      }
    }
    filterRef.current?.disconnect();
    filterRef.current = null;
    mainGainRef.current?.disconnect();
    mainGainRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    sessionStartRef.current = null;
  }, [cancelScheduledChimes]);

  const initSoundscape = useCallback(
    (ctx: AudioContext, theme: number) => {
      const mainGain = ctx.createGain();
      mainGain.gain.setValueAtTime(0, ctx.currentTime);
      mainGainRef.current = mainGain;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.setValueAtTime(4, ctx.currentTime);
      filter.frequency.setValueAtTime(MIN_CUTOFF, ctx.currentTime);
      filterRef.current = filter;

      const baseFreq = getThemeBaseFrequency(theme);
      const oscL = ctx.createOscillator();
      const oscR = ctx.createOscillator();

      oscL.type = 'sine';
      oscR.type = 'sine';
      oscL.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      oscR.frequency.setValueAtTime(baseFreq + BINAURAL_OFFSET_DEFAULT, ctx.currentTime);

      const pannerL = ctx.createStereoPanner();
      const pannerR = ctx.createStereoPanner();
      pannerL.pan.setValueAtTime(-1, ctx.currentTime);
      pannerR.pan.setValueAtTime(1, ctx.currentTime);

      oscL.connect(pannerL).connect(filter);
      oscR.connect(pannerR).connect(filter);
      filter.connect(mainGain).connect(ctx.destination);

      oscL.start();
      oscR.start();
      oscLRef.current = oscL;
      oscRRef.current = oscR;
      sessionStartRef.current = monotonicNow();
    },
    [],
  );

  // Initialize or tear down the continuous soundscape when running state changes.
  useEffect(() => {
    if (!isRunning) {
      cancelScheduledChimes();
      if (mainGainRef.current && audioCtxRef.current) {
        mainGainRef.current.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.1);
      }
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    if (!mainGainRef.current) {
      initSoundscape(ctx, themeIndexRef.current);
    }

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isRunning, getAudioContext, initSoundscape, cancelScheduledChimes]);

  // Retune fundamentals when the session theme changes mid-practice.
  useEffect(() => {
    const ctx = audioCtxRef.current;
    const oscL = oscLRef.current;
    const oscR = oscRRef.current;
    if (!ctx || !oscL || !oscR || !isRunning) return;

    const baseFreq = getThemeBaseFrequency(themeIndex);
    const offset =
      snapshotRef.current().phase === 'hold1' ? BINAURAL_OFFSET_HOLD : BINAURAL_OFFSET_DEFAULT;
    const now = ctx.currentTime;
    oscL.frequency.setTargetAtTime(baseFreq, now, 0.2);
    oscR.frequency.setTargetAtTime(baseFreq + offset, now, 0.2);
  }, [themeIndex, isRunning]);

  // Phase transition chimes, booked one boundary ahead on the audio clock so
  // they land on the scheduled instant rather than whenever React re-renders.
  useEffect(() => {
    if (!isRunning) return;
    const boundaryOrdinal = phaseOrdinal + 1;
    if (scheduledOrdinalRef.current >= boundaryOrdinal) return;
    scheduledOrdinalRef.current = boundaryOrdinal;
    scheduleChime(nextPhase, nextPhaseAtMs);
  }, [isRunning, phaseOrdinal, nextPhase, nextPhaseAtMs, scheduleChime]);

  // Frame loop: modulate filter, gain, and binaural offset from breath expansion curves.
  useEffect(() => {
    if (!isRunning) return;

    const modulateAudioNodes = () => {
      const ctx = audioCtxRef.current;
      const mainGain = mainGainRef.current;
      const filter = filterRef.current;
      const oscR = oscRRef.current;

      if (!ctx || !mainGain || !filter || ctx.state === 'suspended') {
        animationFrameRef.current = requestAnimationFrame(modulateAudioNodes);
        return;
      }

      const sessionTime = sessionStartRef.current
        ? (monotonicNow() - sessionStartRef.current) / 1000
        : 0;
      const { phase, phaseProgress: progress } = snapshotRef.current();
      const theme = themeIndexRef.current;
      const expand = getAudioBreathExpand(phase, progress, sessionTime);
      const now = ctx.currentTime;

      if (muteRef.current) {
        mainGain.gain.setTargetAtTime(0, now, 0.05);
      } else {
        const targetCutoff = MIN_CUTOFF + (MAX_CUTOFF - MIN_CUTOFF) * expand;
        filter.frequency.setTargetAtTime(targetCutoff, now, 0.05);

        const dynamicVolume = BASE_GAIN + expand * MAX_DYNAMIC_GAIN;
        if (phase === 'hold2') {
          mainGain.gain.setTargetAtTime(HOLD2_GAIN, now, 0.1);
        } else {
          mainGain.gain.setTargetAtTime(dynamicVolume, now, 0.05);
        }

        if (oscR) {
          const baseFreq = getThemeBaseFrequency(theme);
          const binauralOffset = phase === 'hold1' ? BINAURAL_OFFSET_HOLD : BINAURAL_OFFSET_DEFAULT;
          oscR.frequency.setTargetAtTime(baseFreq + binauralOffset, now, 0.2);
        }
      }

      animationFrameRef.current = requestAnimationFrame(modulateAudioNodes);
    };

    animationFrameRef.current = requestAnimationFrame(modulateAudioNodes);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isRunning]);

  useEffect(() => teardownSoundscape, [teardownSoundscape]);

  const toggleMute = useCallback(() => {
    const next = !muteRef.current;
    muteRef.current = next;
    setIsMuted(next);

    if (next) cancelScheduledChimes();

    const ctx = audioCtxRef.current;
    const mainGain = mainGainRef.current;
    if (ctx && mainGain) {
      mainGain.gain.setTargetAtTime(next ? 0 : BASE_GAIN, ctx.currentTime, 0.05);
    }
  }, [cancelScheduledChimes]);

  return { toggleMute, isMuted };
};
