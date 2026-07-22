'use client';

import React from 'react';
import BreathingAvatar from '../../components/BreathingAvatar';
import type { BreathPhase } from '../../hooks/useBreathTimer';

const PHASE_COLORS: Record<string, string> = {
  inhale: 'text-cyan-400',
  hold1: 'text-purple-400',
  exhale: 'text-orange-400',
  hold2: 'text-violet-400',
};

interface PhaseDisplayProps {
  currentPhase: BreathPhase;
  breathPhase: number;
  remaining: number;
  phaseProgress: number;
  totalBreaths: number;
  figurePose: number;
  muscleCue: string;
}

export default function PhaseDisplay({
  currentPhase,
  breathPhase,
  remaining,
  phaseProgress,
  totalBreaths,
  figurePose,
  muscleCue,
}: PhaseDisplayProps) {
  return (
    <div className="relative z-10 min-h-dvh flex flex-col items-center justify-center pointer-events-none px-4">
      <div
        className={`text-5xl font-light uppercase tracking-[6px] transition-all duration-700 [text-shadow:0_2px_12px_rgba(0,0,0,0.85)] ${PHASE_COLORS[currentPhase]}`}
        data-tour="phase"
      >
        {currentPhase}
      </div>
      <div className="text-7xl font-mono font-light text-white/95 mt-2 tabular-nums [text-shadow:0_2px_16px_rgba(0,0,0,0.9)]" data-tour="countdown">
        {Math.max(0, remaining).toFixed(0).padStart(2, '0')}
      </div>

      <div className="relative w-64 h-64 mt-6" data-tour="ring">
        <svg className="w-64 h-64 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#1a0f2e" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray="282.743"
            strokeDashoffset={282.743 * (1 - breathPhase)}
            strokeLinecap="round"
            className={`transition-all duration-300 ${PHASE_COLORS[currentPhase]}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="w-28 h-28 flex items-center justify-center">
            <BreathingAvatar
              currentPhase={currentPhase}
              phaseProgress={phaseProgress}
              totalBreaths={totalBreaths}
              figurePose={figurePose}
            />
          </div>
          <div className="absolute -bottom-8 w-64 text-center" data-tour="controls">
            <p className="text-[11px] uppercase tracking-[2px] text-white/50 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/5 animate-pulse motion-reduce:animate-none">
              {muscleCue}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
