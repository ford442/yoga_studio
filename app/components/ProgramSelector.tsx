'use client';

import React, { useEffect, useId, useRef } from 'react';
import type { Program, ActiveProgramProgress } from '../types/program';
import { DIFFICULTY_LABELS, PRACTICE_GOALS } from '../types/technique';
import {
  getProgramCompletionCount,
  getProgramTotalSessions,
  isProgramComplete,
} from '../data/programs';

interface ProgramSelectorProps {
  programs: Program[];
  activeProgramId: string | null;
  activeProgress: ActiveProgramProgress | null;
  open: boolean;
  onClose: () => void;
  onSelect: (programId: string) => void;
  onAbandon: () => void;
  onReset: () => void;
}

const ProgramSelector: React.FC<ProgramSelectorProps> = ({
  programs,
  activeProgramId,
  activeProgress,
  open,
  onClose,
  onSelect,
  onAbandon,
  onReset,
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-auto">
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        aria-label="Close program selector"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="onboarding-panel-enter relative w-full max-w-md max-h-[min(85vh,640px)] overflow-y-auto rounded-t-3xl border border-white/15 bg-[#0c0818]/98 backdrop-blur-xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl"
      >
        <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-500" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] tracking-[0.24em] text-cyan-300/80 uppercase">Multi-day journeys</p>
            <h2 id={titleId} className="mt-1 text-2xl font-light text-white">
              Programs
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-xs tracking-widest hover:bg-white/18 transition-colors"
          >
            CLOSE
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-white/65">
          Choose a guided sequence. Each day recommends a technique and duration. You can still use free practice anytime.
        </p>

        <div className="mt-6 space-y-4">
          {programs.map((program) => {
            const isActive = activeProgramId === program.id;
            const completed = isActive ? getProgramCompletionCount(program, activeProgress) : 0;
            const total = getProgramTotalSessions(program);
            const complete = isActive && isProgramComplete(program, activeProgress);

            return (
              <div
                key={program.id}
                className={`relative rounded-2xl border p-4 transition-all ${
                  isActive
                    ? 'bg-emerald-500/10 border-emerald-300/40'
                    : 'bg-white/5 border-white/12 hover:bg-white/8'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl leading-none" aria-hidden="true">
                    {program.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-light text-white truncate">{program.label}</h3>
                      {isActive && (
                        <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] uppercase tracking-wider text-emerald-200">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-white/55 leading-relaxed">
                      {program.description}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-white/60">
                      <span className="rounded-md bg-white/8 px-1.5 py-0.5">
                        {DIFFICULTY_LABELS[program.difficulty]}
                      </span>
                      <span className="rounded-md bg-white/8 px-1.5 py-0.5">{program.durationDays} days</span>
                      <span className="rounded-md bg-white/8 px-1.5 py-0.5">
                        {program.goals
                          .map((g) => PRACTICE_GOALS.find((pg) => pg.id === g)?.emoji ?? g)
                          .join(' ')}
                      </span>
                    </div>

                    {isActive && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[10px] text-white/70 mb-1">
                          <span>Progress</span>
                          <span>
                            {complete ? 'Complete' : `${completed} / ${total} sessions`}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all"
                            style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
                          />
                        </div>
                        <div className="mt-3 flex gap-2">
                          {complete ? (
                            <>
                              <button
                                type="button"
                                onClick={onReset}
                                className="flex-1 rounded-xl bg-white/10 border border-white/15 py-2 text-[10px] tracking-widest hover:bg-white/16 transition-colors"
                              >
                                RESTART PROGRAM
                              </button>
                              <button
                                type="button"
                                onClick={onAbandon}
                                className="flex-1 rounded-xl bg-white/10 border border-white/15 py-2 text-[10px] tracking-widest text-white/70 hover:bg-white/16 transition-colors"
                              >
                                LEAVE
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={onAbandon}
                              className="rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-[10px] tracking-widest text-white/70 hover:bg-white/16 transition-colors"
                            >
                              LEAVE PROGRAM
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => onSelect(program.id)}
                        className="mt-3 w-full rounded-xl bg-white/10 border border-white/15 py-2 text-[10px] tracking-widest hover:bg-white/16 active:scale-95 transition-all"
                      >
                        START PROGRAM
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProgramSelector;
