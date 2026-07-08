'use client';

import React, { useEffect, useId, useRef } from 'react';
import type { SessionMode } from '../types/sessionMode';

interface TechniqueScienceSheetProps {
  technique: SessionMode;
  open: boolean;
  onClose: () => void;
}

const TechniqueScienceSheet: React.FC<TechniqueScienceSheetProps> = ({
  technique,
  open,
  onClose,
}) => {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const { technique: meta } = technique;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-auto">
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        aria-label="Close science panel"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="onboarding-panel-enter relative w-full max-w-md max-h-[min(85vh,640px)] overflow-y-auto rounded-t-3xl border border-white/15 bg-[#0c0818]/98 backdrop-blur-xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl"
      >
        <div
          className="absolute left-0 top-0 h-1 w-full"
          style={{ background: `linear-gradient(90deg, ${technique.accentColor ?? '#9b8cff'}, transparent)` }}
        />

        <p className="text-[10px] tracking-[0.24em] text-cyan-300/80 uppercase">Science behind the practice</p>
        <h2 id={titleId} className="mt-2 text-2xl font-light text-white">
          {meta.commonName}
        </h2>
        <p className="text-sm text-white/55 italic">{meta.sanskritName}</p>

        <p className="mt-4 text-sm leading-relaxed text-white/78">{meta.scienceDetail}</p>

        <div className="mt-6 grid gap-3 text-[12px]">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
            <p className="text-white/45 uppercase tracking-wider text-[10px]">Tradition</p>
            <p className="mt-1 text-white/75">{meta.tradition}</p>
          </div>
          {meta.bandhaFocus && (
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
              <p className="text-white/45 uppercase tracking-wider text-[10px]">Bandha focus</p>
              <p className="mt-1 text-white/75">{meta.bandhaFocus}</p>
            </div>
          )}
          {meta.drishtiCue && (
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
              <p className="text-white/45 uppercase tracking-wider text-[10px]">Drishti</p>
              <p className="mt-1 text-white/75">{meta.drishtiCue}</p>
            </div>
          )}
        </div>

        <p className="mt-5 text-[11px] text-white/40 leading-relaxed">
          Traditional wisdom and contemporary research inform these summaries. This app is a practice companion, not medical advice.
        </p>

        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="mt-5 w-full min-h-[48px] rounded-2xl bg-white/12 border border-white/18 text-sm tracking-widest hover:bg-white/18 transition-colors"
        >
          RETURN TO PRACTICE
        </button>
      </div>
    </div>
  );
};

export default TechniqueScienceSheet;
