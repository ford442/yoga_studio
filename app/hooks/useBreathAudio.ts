import { useEffect, useRef, useState } from 'react';
import type { BreathPhase } from './useBreathTimer';

export const useBreathAudio = (currentPhase: BreathPhase, isRunning: boolean) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastPhaseRef = useRef<BreathPhase>(currentPhase);
  const muteRef = useRef(false);
  const [isMuted, setIsMuted] = useState(false);

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      audioContextRef.current = new (AudioContextCtor || AudioContext)();
    }
    return audioContextRef.current;
  };

  const playChime = (frequency: number, duration: number = 800, type: OscillatorType = 'sine') => {
    if (muteRef.current || !isRunning) return;
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
  };

  // Phase transition chimes
  useEffect(() => {
    if (!isRunning || currentPhase === lastPhaseRef.current) return;

    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    switch (currentPhase) {
      case 'inhale':
        playChime(432, 1200, 'sine');     // root chakra tone
        break;
      case 'hold1':
        playChime(528, 900, 'triangle');  // love/heart tone
        break;
      case 'exhale':
        playChime(396, 1100, 'sine');
        break;
      case 'hold2':
        playChime(639, 800, 'triangle');
        break;
    }

    lastPhaseRef.current = currentPhase;
  }, [currentPhase, isRunning]);

  // Optional very subtle ambient drone (low humming bowl)
  useEffect(() => {
    if (!isRunning || muteRef.current) return;

    const ctx = getAudioContext();
    const drone = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    drone.frequency.setValueAtTime(110, ctx.currentTime); // low A
    drone.type = 'sine';

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, ctx.currentTime);

    gain.gain.setValueAtTime(0.035, ctx.currentTime); // very quiet

    drone.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    drone.start();

    return () => {
      drone.stop();
    };
  }, [isRunning]);

  const toggleMute = () => {
    const next = !muteRef.current;
    muteRef.current = next;
    setIsMuted(next);
  };

  return { toggleMute, isMuted };
};
