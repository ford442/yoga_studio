'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { TourStep } from '../data/onboarding';
import { INTRO_TOUR_STEPS } from '../data/onboarding';

interface PracticeIntroTourProps {
  steps?: TourStep[];
  onComplete: () => void;
  onSkip: () => void;
}

const TARGET_HINTS: Record<TourStep['target'], string> = {
  phase: 'Look at the phase label above the countdown',
  countdown: 'The large number is your phase timer',
  ring: 'The circular ring tracks your full breath cycle',
  controls: 'Posture cues appear below the avatar',
  modes: 'Session modes live in the bottom panel',
};

const PracticeIntroTour: React.FC<PracticeIntroTourProps> = ({
  steps = INTRO_TOUR_STEPS,
  onComplete,
  onSkip,
}) => {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const isLast = index >= steps.length - 1;

  const advance = useCallback(() => {
    if (isLast) {
      onComplete();
      return;
    }
    setIndex((i) => i + 1);
  }, [isLast, onComplete]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, onSkip]);

  if (!step) return null;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-40 flex items-end justify-center p-4 pb-[calc(6rem+env(safe-area-inset-bottom))]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="intro-tour-title"
      aria-describedby="intro-tour-body"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label="Skip intro tour"
        onClick={onSkip}
      />

      <div className="onboarding-panel-enter relative w-full max-w-md rounded-2xl border border-white/20 bg-[#0c0818]/95 backdrop-blur-xl p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-[10px] tracking-[0.22em] text-white/50 uppercase">
            Step {index + 1} of {steps.length}
          </p>
          <button
            type="button"
            onClick={onSkip}
            className="text-[11px] text-white/50 hover:text-white/75 tracking-wide"
          >
            Skip
          </button>
        </div>

        <div className="h-1 rounded-full bg-white/10 overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 transition-all duration-500 motion-reduce:transition-none"
            style={{ width: `${((index + 1) / steps.length) * 100}%` }}
          />
        </div>

        <h3 id="intro-tour-title" className="text-lg font-light text-white tracking-wide">
          {step.title}
        </h3>
        <p id="intro-tour-body" className="mt-2 text-sm leading-relaxed text-white/72">
          {step.body}
        </p>
        <p className="mt-2 text-[11px] text-cyan-200/70 italic">{TARGET_HINTS[step.target]}</p>

        <button
          type="button"
          onClick={advance}
          className="mt-5 w-full min-h-[48px] rounded-xl bg-white/12 border border-white/20 text-sm tracking-widest hover:bg-white/18 active:scale-[0.98] transition-all"
        >
          {isLast ? 'START BREATHING' : 'NEXT'}
        </button>
      </div>
    </div>
  );
};

export default PracticeIntroTour;
