'use client';

import React from 'react';
import { WELCOME_COPY } from '../data/onboarding';

interface WelcomePanelProps {
  onQuickStart: () => void;
  onTakeTour: () => void;
  onExplore: () => void;
  onSkipForever: () => void;
}

const WelcomePanel: React.FC<WelcomePanelProps> = ({
  onQuickStart,
  onTakeTour,
  onExplore,
  onSkipForever,
}) => {
  return (
    <section
      className="onboarding-panel-enter pointer-events-auto fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 px-4"
      aria-label="Welcome to Sacred Breath"
    >
      <div className="max-w-md mx-auto rounded-3xl border border-white/20 bg-[#0a0614]/92 backdrop-blur-xl shadow-2xl shadow-purple-900/30 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-cyan-400 via-purple-400 to-orange-300" />

        <div className="p-5 sm:p-6">
          <p className="text-[10px] tracking-[0.28em] text-cyan-300/90 uppercase">Welcome</p>
          <h2 className="mt-2 text-2xl font-light tracking-wide text-white">{WELCOME_COPY.title}</h2>
          <p className="mt-1 text-sm text-purple-200/80 font-light">{WELCOME_COPY.subtitle}</p>
          <p className="mt-3 text-[13px] leading-relaxed text-white/72">{WELCOME_COPY.body}</p>

          <button
            type="button"
            onClick={onQuickStart}
            className="mt-5 w-full min-h-[52px] rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-600 text-base font-light tracking-[0.18em] text-white shadow-lg shadow-purple-600/25 hover:brightness-110 active:scale-[0.98] transition-all"
          >
            BEGINNER QUICK START · 5 MIN
          </button>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onTakeTour}
              className="min-h-[44px] rounded-xl border border-white/20 bg-white/8 text-[11px] tracking-wider text-white/88 hover:bg-white/14 active:scale-[0.98] transition-all"
            >
              HOW IT WORKS · 60S
            </button>
            <button
              type="button"
              onClick={onExplore}
              className="min-h-[44px] rounded-xl border border-white/15 bg-black/25 text-[11px] tracking-wider text-white/75 hover:bg-black/35 active:scale-[0.98] transition-all"
            >
              EXPLORE ALL MODES
            </button>
          </div>

          <button
            type="button"
            onClick={onSkipForever}
            className="mt-4 w-full text-[11px] tracking-wide text-white/45 hover:text-white/65 transition-colors underline-offset-2 hover:underline"
          >
            Skip onboarding — I know my way around
          </button>
        </div>
      </div>
    </section>
  );
};

export default WelcomePanel;
