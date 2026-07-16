'use client';

import React from 'react';
import type { ActiveProgramProgress } from '../types/program';
import { TECHNIQUES } from '../data/techniques';
import {
  getProgramById,
  getNextSessionDay,
  isProgramComplete,
  resolveProgramSessionTechnique,
} from '../data/programs';

interface ProgramNextSessionCardProps {
  activeProgramId: string | null;
  activeProgress: ActiveProgramProgress | null;
  isRunning: boolean;
  onOpenSelector: () => void;
  onStartSession: (programId: string, dayIndex: number) => void;
}

const ProgramNextSessionCard: React.FC<ProgramNextSessionCardProps> = ({
  activeProgramId,
  activeProgress,
  isRunning,
  onOpenSelector,
  onStartSession,
}) => {
  const activeProgram = activeProgramId ? getProgramById(activeProgramId) : undefined;

  if (!activeProgram || !activeProgress) {
    return (
      <button
        type="button"
        onClick={onOpenSelector}
        className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-left backdrop-blur-sm hover:bg-white/8 active:scale-[0.99] transition-all"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] tracking-[0.22em] text-white/60 uppercase">Programs</p>
            <p className="mt-0.5 text-sm text-white/90">Choose a multi-day practice journey</p>
          </div>
          <span className="rounded-xl bg-white/10 px-3 py-2 text-[10px] tracking-widest border border-white/15">
            BROWSE
          </span>
        </div>
      </button>
    );
  }

  const complete = isProgramComplete(activeProgram, activeProgress);

  if (complete) {
    return (
      <div className="w-full rounded-2xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] tracking-[0.22em] text-emerald-200/80 uppercase">Program complete</p>
            <p className="mt-0.5 text-sm text-white/90">
              {activeProgram.emoji} {activeProgram.label} finished
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenSelector}
            className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-[10px] tracking-widest border border-white/15 hover:bg-white/16 transition-colors"
          >
            NEW PROGRAM
          </button>
        </div>
      </div>
    );
  }

  const nextDay = getNextSessionDay(activeProgram, activeProgress);

  if (!nextDay) {
    // Should not happen if not complete, but render a fallback.
    return (
      <button
        type="button"
        onClick={onOpenSelector}
        className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-left backdrop-blur-sm hover:bg-white/8 transition-all"
      >
        <p className="text-[10px] tracking-[0.22em] text-white/60 uppercase">Programs</p>
        <p className="mt-0.5 text-sm text-white/90">Continue your program</p>
      </button>
    );
  }

  const technique = resolveProgramSessionTechnique(nextDay, TECHNIQUES);
  const durationLabel = nextDay.durationMinutes === 'free' ? 'Free' : `${nextDay.durationMinutes} min`;

  return (
    <div className="w-full rounded-2xl border border-white/15 bg-black/25 backdrop-blur-md px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] tracking-[0.22em] text-white/60 uppercase">
            Day {nextDay.dayIndex + 1} · {activeProgram.label}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl leading-none">{technique.emoji}</span>
            <div className="min-w-0">
              <p className="text-base font-light text-white truncate [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]">
                {technique.technique.commonName}
              </p>
              <p className="text-[10px] text-white/50 truncate">
                {durationLabel} · {technique.technique.sanskritName}
              </p>
            </div>
          </div>
          {nextDay.note && (
            <p className="mt-1.5 text-[11px] text-cyan-200/75 leading-snug line-clamp-2">
              {nextDay.note}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <button
            type="button"
            disabled={isRunning}
            onClick={() => onStartSession(activeProgram.id, nextDay.dayIndex)}
            className="rounded-xl bg-gradient-to-r from-emerald-500/80 to-cyan-500/80 px-4 py-2 text-[10px] tracking-widest text-white shadow-lg shadow-cyan-500/20 hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            START
          </button>
          <button
            type="button"
            onClick={onOpenSelector}
            className="text-[10px] tracking-wider text-white/40 hover:text-white/70 transition-colors"
          >
            Change
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProgramNextSessionCard;
