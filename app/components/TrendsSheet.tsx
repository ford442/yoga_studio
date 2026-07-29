'use client';

import React, { useEffect, useRef } from 'react';
import { SESSION_MODES } from '../data/sessionModes';
import type { DailyTrend, LegacyStatsBaseline, TechniqueTotal } from '../lib/sessionLedger';

interface TrendsSheetProps {
  open: boolean;
  onClose: () => void;
  trends: DailyTrend[];
  techniqueTotals: TechniqueTotal[];
  legacyBaseline?: LegacyStatsBaseline;
}

const intensityClass = (minutes: number): string => {
  if (minutes === 0) return 'bg-white/8 border-white/10';
  if (minutes < 5) return 'bg-cyan-900/80 border-cyan-700/70';
  if (minutes < 10) return 'bg-cyan-600/85 border-cyan-400/70';
  if (minutes < 15) return 'bg-purple-500/90 border-purple-300/70';
  return 'bg-orange-400 border-orange-200/90';
};

export default function TrendsSheet({ open, onClose, trends, techniqueTotals, legacyBaseline }: TrendsSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/75" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="trends-title"
        className="max-h-[88dvh] w-full max-w-md mx-auto overflow-y-auto rounded-t-3xl border border-white/15 bg-[#0f081f] p-6 text-white shadow-2xl"
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 id="trends-title" className="text-2xl font-light">Practice trends</h2>
            <p className="mt-1 text-xs text-white/50">Your last 28 days, in UTC</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close practice trends" className="rounded-full border border-white/20 px-3 py-2 text-white/75 hover:bg-white/10">✕</button>
        </div>

        <div aria-label="28 day practice activity" className="grid grid-cols-7 gap-2">
          {trends.map((day) => (
            <div
              key={day.date}
              data-date={day.date}
              title={`${day.date}: ${day.minutes} minutes`}
              aria-label={`${day.date}, ${day.minutes} minutes`}
              className={`aspect-square rounded-md border ${intensityClass(day.minutes)}`}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/50" aria-label="Activity intensity legend">
          <span>None</span><span>&lt;5 min</span><span>5–9</span><span>10–14</span><span>15+ min</span>
        </div>

        <div className="mt-8">
          <h3 className="text-sm tracking-widest text-white/65">BY TECHNIQUE</h3>
          {techniqueTotals.length === 0 ? (
            <p className="mt-3 text-sm text-white/45">Complete a practice to begin your breakdown.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {techniqueTotals.map((total) => {
                const mode = SESSION_MODES.find((entry) => entry.id === total.techniqueId);
                return (
                  <li key={total.techniqueId} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                    <span className="text-sm text-white/80">{mode ? `${mode.emoji} ${mode.label}` : total.techniqueId}</span>
                    <span className="font-mono text-sm text-cyan-200">{total.minutes} min</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {legacyBaseline && (
          <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4">
            <h3 className="text-xs tracking-widest text-amber-200/80">MIGRATED · UNATTRIBUTED</h3>
            <p className="mt-2 text-sm text-white/65">
              {legacyBaseline.todayMinutes} minutes and {legacyBaseline.todayBreaths} breaths were preserved from earlier stats. They are included in headline totals when applicable, but cannot be truthfully assigned to historical days or techniques.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
