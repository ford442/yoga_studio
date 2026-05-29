import { useRef } from 'react';

export const useRippleAudio = () => {
  const audioContextRef = useRef<AudioContext | null>(null);

  const playRipple = (strength: number = 0.6) => {
    if (!('AudioContext' in window)) return;

    const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const ctx = audioContextRef.current || new (AudioContextCtor || AudioContext)();
    audioContextRef.current = ctx;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(80 + strength * 220, ctx.currentTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, ctx.currentTime);

    gain.gain.setValueAtTime(0.25 * strength, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.7);
  };

  return { playRipple };
};
