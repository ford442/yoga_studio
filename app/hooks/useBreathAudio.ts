'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BreathPhase } from './useBreathTimer';
import { getAudioBreathExpand, getThemeBaseFrequency } from '../utils/audioEasing';

interface UseBreathAudioProps {
  currentPhase: BreathPhase;
  phaseProgress: number;
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
  currentPhase,
  phaseProgress,
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
  const lastPhaseRef = useRef<BreathPhase>(currentPhase);
  const muteRef = useRef(false);
  const isRunningRef = useRef(isRunning);
  const [isMuted, setIsMuted] = useState(false);

  const currentPhaseRef = useRef(currentPhase);
  const phaseProgressRef = useRef(phaseProgress);
  const themeIndexRef = useRef(themeIndex);

  useEffect(() => {
    currentPhaseRef.current = currentPhase;
  }, [currentPhase]);

  useEffect(() => {
    phaseProgressRef.current = phaseProgress;
  }, [phaseProgress]);

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

  const playChime = useCallback(
    (frequency: number, duration: number, type: OscillatorType) => {
      if (muteRef.current || !isRunningRef.current) return;
      const ctx = getAudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
      oscillator.type = type;

      gain.gain.setValueAtTime(0.6, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);

      oscillator.start();
      oscillator.stop(ctx.currentTime + duration / 1000);
    },
    [getAudioContext],
  );

  const teardownSoundscape = useCallback(() => {
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
  }, []);

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
      sessionStartRef.current = performance.now();
    },
    [],
  );

  // Initialize or tear down the continuous soundscape when running state changes.
  useEffect(() => {
    if (!isRunning) {
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
  }, [isRunning, getAudioContext, initSoundscape]);

  // Retune fundamentals when the session theme changes mid-practice.
  useEffect(() => {
    const ctx = audioCtxRef.current;
    const oscL = oscLRef.current;
    const oscR = oscRRef.current;
    if (!ctx || !oscL || !oscR || !isRunning) return;

    const baseFreq = getThemeBaseFrequency(themeIndex);
    const offset =
      currentPhaseRef.current === 'hold1' ? BINAURAL_OFFSET_HOLD : BINAURAL_OFFSET_DEFAULT;
    const now = ctx.currentTime;
    oscL.frequency.setTargetAtTime(baseFreq, now, 0.2);
    oscR.frequency.setTargetAtTime(baseFreq + offset, now, 0.2);
  }, [themeIndex, isRunning]);

  // Phase transition chimes (discrete markers layered on the continuous drone).
  useEffect(() => {
    if (!isRunning || currentPhase === lastPhaseRef.current) return;

    const chime = CHIME_FREQUENCIES[currentPhase];
    playChime(chime.freq, chime.duration, chime.type);
    lastPhaseRef.current = currentPhase;
  }, [currentPhase, isRunning, playChime]);

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
        ? (performance.now() - sessionStartRef.current) / 1000
        : 0;
      const phase = currentPhaseRef.current;
      const progress = phaseProgressRef.current;
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

    const ctx = audioCtxRef.current;
    const mainGain = mainGainRef.current;
    if (ctx && mainGain) {
      mainGain.gain.setTargetAtTime(next ? 0 : BASE_GAIN, ctx.currentTime, 0.05);
    }
  }, []);

  return { toggleMute, isMuted };
};
