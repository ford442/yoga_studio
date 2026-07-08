'use client';

import React, { useEffect } from 'react';
import { FIRST_SESSION_BENEFIT } from '../data/onboarding';

interface CompletionScreenProps {
  minutes: number;
  breaths: number;
  streak: number;
  onClose: () => void;
  isFirstSession?: boolean;
  practicedModeLabel?: string;
  practicedModeEmoji?: string;
  nextStepLabel?: string;
  nextStepReason?: string;
  onTryNext?: () => void;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const CompletionScreen: React.FC<CompletionScreenProps> = ({
  minutes,
  breaths,
  streak,
  onClose,
  isFirstSession = false,
  practicedModeLabel,
  practicedModeEmoji,
  nextStepLabel,
  nextStepReason,
  onTryNext,
}) => {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const count = isFirstSession ? 35 : 80;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    for (let i = 0; i < count; i++) {
      const t = setTimeout(() => {
        const confetti = document.createElement('div');
        confetti.className = 'fixed text-2xl pointer-events-none z-[60]';
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.top = '-20px';
        confetti.textContent = ['✨', '🪷', '🌟', '🙏'][Math.floor(Math.random() * 4)];
        document.body.appendChild(confetti);

        confetti.animate(
          [
            { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
            {
              transform: `translateY(${window.innerHeight + 100}px) rotate(${Math.random() * 800 - 400}deg)`,
              opacity: 0,
            },
          ],
          {
            duration: 2800 + Math.random() * 1200,
            easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
          },
        );

        setTimeout(() => confetti.remove(), 5000);
      }, i * (isFirstSession ? 28 : 18));
      timeouts.push(t);
    }

    return () => timeouts.forEach(clearTimeout);
  }, [isFirstSession]);

  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="completion-title"
    >
      <div className="text-center max-w-sm">
        <div className="text-7xl mb-5" aria-hidden="true">
          {isFirstSession ? '🌱' : '🪷'}
        </div>
        <h2 id="completion-title" className="text-4xl sm:text-5xl font-light tracking-widest mb-2">
          {isFirstSession ? 'First Session Complete' : 'Session Complete'}
        </h2>
        <p className="text-white/60 mb-8">
          {isFirstSession
            ? 'You showed up. That is the practice.'
            : 'Beautiful work. You are peace.'}
        </p>

        {isFirstSession && practicedModeLabel && (
          <div className="mb-8 rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-left">
            <p className="text-[10px] tracking-[0.2em] text-white/45 uppercase">You practiced</p>
            <p className="mt-1 text-lg text-white font-light">
              {practicedModeEmoji && <span className="mr-2">{practicedModeEmoji}</span>}
              {practicedModeLabel}
            </p>
            <p className="mt-3 text-[12px] leading-relaxed text-cyan-200/75">{FIRST_SESSION_BENEFIT}</p>
          </div>
        )}

        <div className="space-y-6 mb-10">
          <div>
            <div className="text-5xl sm:text-6xl font-light text-cyan-300 tabular-nums">{minutes}</div>
            <div className="text-sm tracking-widest text-white/40">MINUTES OF PRESENCE</div>
          </div>
          <div>
            <div className="text-5xl sm:text-6xl font-light text-purple-300 tabular-nums">{breaths}</div>
            <div className="text-sm tracking-widest text-white/40">CONSCIOUS BREATHS</div>
          </div>
          <div>
            <div className="text-5xl sm:text-6xl font-light text-orange-300 flex items-center justify-center gap-3 tabular-nums">
              {streak} <span aria-hidden="true">🔥</span>
            </div>
            <div className="text-sm tracking-widest text-white/40">DAY STREAK</div>
          </div>
        </div>

        {isFirstSession && nextStepLabel && onTryNext && (
          <button
            type="button"
            onClick={onTryNext}
            className="w-full mb-3 min-h-[52px] py-4 text-sm tracking-widest bg-gradient-to-r from-emerald-500/80 to-cyan-500/80 rounded-3xl hover:brightness-110 transition-all"
          >
            TRY {nextStepLabel.toUpperCase()} NEXT
          </button>
        )}

        {isFirstSession && nextStepReason && (
          <p className="mb-6 text-[12px] text-white/50 leading-relaxed px-2">{nextStepReason}</p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full min-h-[52px] py-4 text-lg tracking-widest bg-gradient-to-r from-purple-500 to-cyan-500 rounded-3xl hover:brightness-110 transition-all"
        >
          RETURN TO PRACTICE
        </button>
      </div>
    </div>
  );
};

export default CompletionScreen;
