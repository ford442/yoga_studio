'use client';

import React, { useMemo, useState } from 'react';
import type { SessionMode } from '../types/sessionMode';
import type { BreathSettings } from '../hooks/useBreathTimer';
import type { PracticeGoal } from '../types/technique';
import { DIFFICULTY_LABELS, PRACTICE_GOALS } from '../types/technique';
import { filterTechniquesByGoal, getRecommendedTechniques } from '../data/techniques';
import TechniqueScienceSheet from './TechniqueScienceSheet';

type BreathSettingKey = keyof BreathSettings;

interface TechniquesLibraryProps {
  modes: SessionMode[];
  selectedModeId: string;
  isRunning: boolean;
  activeBreath: BreathSettings;
  favoriteModeIds: string[];
  onSelect: (mode: SessionMode) => void;
  onStart: (mode: SessionMode, duration: 'free' | 5 | 10 | 15) => void;
  onNudge: (key: BreathSettingKey, delta: number) => void;
  onSetPhaseDuration: (key: BreathSettingKey, value: number) => void;
  onToggleFavorite: (modeId: string) => void;
}

const FALLBACK_ACCENTS: Record<number, string> = {
  [-1]: '#9b8cff',
  0: '#e63946',
  1: '#fa7e1e',
  2: '#f4d35e',
  3: '#2ecc71',
  4: '#4a90e2',
  5: '#5b3cc4',
  6: '#a64dff',
};

const hexToRgb = (hex: string): [number, number, number] => {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return [155, 140, 255];
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return [r, g, b];
};

const getModeAccent = (mode: SessionMode) =>
  mode.accentColor ?? FALLBACK_ACCENTS[mode.chakraFocusIndex] ?? FALLBACK_ACCENTS[-1];

const getSegments = (breath: BreathSettings) => [
  { key: 'inhale', value: breath.inhale, className: 'bg-cyan-400' },
  { key: 'hold1', value: breath.hold1, className: 'bg-purple-400' },
  { key: 'exhale', value: breath.exhale, className: 'bg-orange-400' },
  { key: 'hold2', value: breath.hold2, className: 'bg-violet-400' },
];

const PHASE_CONTROLS: Array<{
  key: BreathSettingKey;
  label: string;
  shortLabel: string;
  colorClass: string;
  min: number;
  max: number;
}> = [
  { key: 'inhale', label: 'Inhale', shortLabel: 'IN', colorClass: 'bg-cyan-400', min: 1, max: 15 },
  { key: 'hold1', label: 'Hold', shortLabel: 'H1', colorClass: 'bg-purple-400', min: 0, max: 15 },
  { key: 'exhale', label: 'Exhale', shortLabel: 'EX', colorClass: 'bg-orange-400', min: 1, max: 15 },
  { key: 'hold2', label: 'Rest', shortLabel: 'H2', colorClass: 'bg-violet-400', min: 0, max: 10 },
];

const TechniquesLibrary: React.FC<TechniquesLibraryProps> = ({
  modes,
  selectedModeId,
  isRunning,
  activeBreath,
  favoriteModeIds,
  onSelect,
  onStart,
  onNudge,
  onSetPhaseDuration,
  onToggleFavorite,
}) => {
  const [goalFilter, setGoalFilter] = useState<PracticeGoal | 'all'>('all');
  const [libraryExpanded, setLibraryExpanded] = useState(false);
  const [scienceOpen, setScienceOpen] = useState(false);
  const [rippleModeId, setRippleModeId] = useState<string | null>(null);
  const [rippleToken, setRippleToken] = useState(0);

  const selectedMode = modes.find((mode) => mode.id === selectedModeId) ?? modes[0];
  const selectedAccent = selectedMode ? getModeAccent(selectedMode) : FALLBACK_ACCENTS[-1];
  const selectedSegments = getSegments(activeBreath);
  const selectedTotal = Math.max(1, selectedSegments.reduce((sum, seg) => sum + seg.value, 0));
  const selectedIsFavorite = selectedMode ? favoriteModeIds.includes(selectedMode.id) : false;

  const filteredModes = useMemo(
    () => filterTechniquesByGoal(modes, goalFilter),
    [modes, goalFilter],
  );

  const recommendedIds = useMemo(
    () => new Set(getRecommendedTechniques(modes).map((t) => t.id)),
    [modes],
  );

  const handleSelect = (mode: SessionMode) => {
    setRippleModeId(mode.id);
    setRippleToken((prev) => prev + 1);
    onSelect(mode);
    setLibraryExpanded(false);
  };

  return (
    <>
      <div
        className="w-full rounded-2xl bg-black/28 backdrop-blur-md border border-white/15 px-3 py-3 shadow-2xl shadow-black/25"
        style={{ ['--mode-accent' as string]: selectedAccent } as React.CSSProperties}
      >
        {selectedMode && (
          <div className="relative overflow-hidden rounded-xl border border-white/15 bg-black/35 px-3 py-3 mb-3">
            <div
              className="absolute left-0 top-0 h-full w-1.5 bg-[var(--mode-accent)] shadow-[0_0_18px_var(--mode-accent)]"
            />
            <div className="pl-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-white/70 tracking-[0.22em] [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">
                    ACTIVE TECHNIQUE
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-2xl leading-none">{selectedMode.emoji}</span>
                    <div className="min-w-0">
                      <h2 className="text-lg leading-tight font-light text-white truncate [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]">
                        {selectedMode.technique.commonName}
                      </h2>
                      <p className="text-[11px] text-white/55 italic truncate">
                        {selectedMode.technique.sanskritName}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <div className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-[10px] tracking-wider text-white/85 tabular-nums">
                    {activeBreath.inhale}-{activeBreath.hold1}-{activeBreath.exhale}-{activeBreath.hold2}
                  </div>
                  <span className="text-[9px] uppercase tracking-wider text-white/50">
                    {DIFFICULTY_LABELS[selectedMode.technique.difficulty]}
                  </span>
                </div>
              </div>

              <p className="mt-2 text-[12px] text-white/82 leading-snug [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">
                {selectedMode.technique.tagline}
              </p>
              <p className="mt-2 text-[11px] text-cyan-200/75 leading-relaxed line-clamp-2">
                {selectedMode.technique.scienceBenefit}
              </p>
              <p className="mt-2 text-[10px] text-white/55">
                <span className="text-white/40 uppercase tracking-wider">Posture · </span>
                {selectedMode.technique.postureFocus}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setScienceOpen(true)}
                  className="min-h-8 px-3 rounded-lg border border-white/15 bg-white/10 text-[10px] tracking-wider hover:bg-white/16 active:scale-95 transition-all"
                >
                  SCIENCE ℹ️
                </button>
                <button
                  type="button"
                  onClick={() => setLibraryExpanded((v) => !v)}
                  className="min-h-8 px-3 rounded-lg border border-white/15 bg-white/10 text-[10px] tracking-wider hover:bg-white/16 active:scale-95 transition-all"
                  aria-expanded={libraryExpanded}
                >
                  {libraryExpanded ? 'HIDE LIBRARY' : 'BROWSE TECHNIQUES'}
                </button>
              </div>
            </div>
          </div>
        )}

        {(libraryExpanded || !selectedMode) && (
          <>
            <div className="flex items-center justify-between gap-3 mb-2" data-tour="modes">
              <p className="text-[10px] text-white/75 tracking-[0.22em] shrink-0">
                TECHNIQUES LIBRARY
              </p>
              <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
            </div>

            <div
              className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory mb-2"
              role="tablist"
              aria-label="Filter by practice goal"
            >
              {PRACTICE_GOALS.map((goal) => {
                const active = goalFilter === goal.id;
                return (
                  <button
                    key={goal.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setGoalFilter(goal.id)}
                    className={`snap-start shrink-0 min-h-9 px-3 rounded-full border text-[10px] tracking-wider transition-all active:scale-95 ${
                      active
                        ? 'bg-white/18 border-white/35 text-white'
                        : 'bg-black/20 border-white/12 text-white/65 hover:bg-black/30'
                    }`}
                  >
                    {goal.emoji} {goal.label.toUpperCase()}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory max-h-[min(42vh,320px)]">
              {filteredModes.map((mode) => {
                const isActive = mode.id === selectedModeId;
                const isFavorite = favoriteModeIds.includes(mode.id);
                const isRecommended = recommendedIds.has(mode.id);
                const accent = getModeAccent(mode);
                const [r, g, b] = hexToRgb(accent);
                const breath = isActive ? activeBreath : mode.breath;
                const cardStyle = isActive
                  ? ({
                      ['--mode-accent' as string]: accent,
                      boxShadow: `0 0 0 1px rgba(${r}, ${g}, ${b}, 0.70), 0 0 22px 3px rgba(${r}, ${g}, ${b}, 0.42)`,
                    } as React.CSSProperties)
                  : ({ ['--mode-accent' as string]: accent } as React.CSSProperties);

                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => handleSelect(mode)}
                    style={cardStyle}
                    aria-pressed={isActive}
                    className={`relative overflow-hidden flex-shrink-0 snap-start flex min-h-[128px] w-[168px] flex-col items-start gap-1 rounded-xl px-3 py-3 text-left transition-all duration-300 active:scale-95 backdrop-blur-sm ${
                      isActive
                        ? 'mode-card-active border-2 border-[var(--mode-accent)] bg-white/16 text-white'
                        : 'border border-white/15 text-white/82 bg-black/22 hover:bg-black/35 hover:border-white/35'
                    }`}
                  >
                    {rippleModeId === mode.id && (
                      <span
                        key={`${mode.id}-${rippleToken}`}
                        className="mode-card-ripple pointer-events-none absolute inset-0 rounded-xl"
                      />
                    )}
                    <span className="absolute inset-x-0 top-0 h-1 bg-[var(--mode-accent)]" />
                    <span className="flex w-full items-start justify-between gap-1">
                      <span className="text-2xl leading-none">{mode.emoji}</span>
                      <span className="flex flex-col items-end gap-0.5">
                        {isRecommended && goalFilter === 'all' && (
                          <span className="text-[8px] uppercase tracking-wider text-emerald-300/90 bg-emerald-500/15 px-1.5 py-0.5 rounded-full">
                            Start here
                          </span>
                        )}
                        {isActive ? (
                          <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--mode-accent)] text-[10px] text-white">
                            ✓
                          </span>
                        ) : isFavorite ? (
                          <span className="text-xs text-white/65">★</span>
                        ) : null}
                      </span>
                    </span>
                    <span className="text-[12px] font-medium leading-tight text-white line-clamp-2">
                      {mode.technique.commonName}
                    </span>
                    <span className="text-[9px] text-white/50 italic line-clamp-1">
                      {mode.technique.sanskritName}
                    </span>
                    <span className="text-[9px] text-white/60 line-clamp-2 leading-snug flex-1">
                      {mode.technique.scienceBenefit}
                    </span>
                    <span className="mt-auto flex w-full items-center justify-between gap-1 text-[9px] text-white/55">
                      <span className="uppercase tracking-wider">{mode.chakraFocus}</span>
                      <span className="tabular-nums">
                        {breath.inhale}-{breath.hold1}-{breath.exhale}-{breath.hold2}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {filteredModes.length === 0 && (
              <p className="text-center text-[11px] text-white/50 py-4">
                No techniques match this goal — try another filter.
              </p>
            )}
          </>
        )}

        {selectedMode && !isRunning && (
          <div className="mt-1 rounded-xl border border-white/12 bg-black/24 px-3 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-2 flex-1 overflow-hidden rounded-full border border-white/10">
                {selectedSegments.map((segment) =>
                  segment.value > 0 ? (
                    <div
                      key={segment.key}
                      className={segment.className}
                      style={{ width: `${(segment.value / selectedTotal) * 100}%` }}
                    />
                  ) : null,
                )}
              </div>
              <button
                type="button"
                onClick={() => onToggleFavorite(selectedMode.id)}
                className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 border border-white/12 active:scale-90 text-sm"
                aria-label={selectedIsFavorite ? 'Unfavorite technique' : 'Favorite technique'}
              >
                {selectedIsFavorite ? '★' : '☆'}
              </button>
            </div>

            <p className="mt-2 text-[10px] text-white/45">
              Recommended ·{' '}
              {selectedMode.technique.recommendedMinutes.map((m) => `${m} min`).join(' · ')}
            </p>

            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {(['free', 5, 10, 15] as const).map((duration) => (
                <button
                  key={duration}
                  type="button"
                  onClick={() => onStart(selectedMode, duration)}
                  className="min-h-9 rounded-lg bg-white/12 border border-white/15 text-[10px] tracking-wider hover:bg-white/20 active:scale-95 transition-all"
                >
                  {duration === 'free' ? 'FREE' : `${duration} MIN`}
                </button>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {PHASE_CONTROLS.map((phase) => (
                <div key={phase.key} className="rounded-lg border border-white/10 bg-black/18 p-2">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${phase.colorClass}`} />
                      <span className="text-[9px] uppercase tracking-wider text-white/70">
                        {phase.label}
                      </span>
                    </div>
                    <span className="text-[9px] text-white/45">{phase.shortLabel}</span>
                  </div>
                  <div className="grid grid-cols-[2rem_1fr_2rem] gap-1.5">
                    <button
                      type="button"
                      onClick={() => onNudge(phase.key, -1)}
                      className="min-h-8 rounded-md bg-white/10 border border-white/10 active:scale-95 text-sm"
                      aria-label={`Decrease ${phase.label.toLowerCase()}`}
                    >
                      -
                    </button>
                    <label className="sr-only" htmlFor={`phase-${phase.key}`}>
                      {phase.label} seconds
                    </label>
                    <input
                      id={`phase-${phase.key}`}
                      type="number"
                      min={phase.min}
                      max={phase.max}
                      inputMode="numeric"
                      value={activeBreath[phase.key]}
                      onChange={(event) =>
                        onSetPhaseDuration(phase.key, Number.parseInt(event.target.value, 10))
                      }
                      onBlur={(event) =>
                        onSetPhaseDuration(phase.key, Number.parseInt(event.target.value, 10))
                      }
                      className="min-h-8 w-full rounded-md border border-white/10 bg-black/28 px-2 text-center text-[12px] text-white tabular-nums outline-none focus:border-white/35"
                    />
                    <button
                      type="button"
                      onClick={() => onNudge(phase.key, 1)}
                      className="min-h-8 rounded-md bg-white/10 border border-white/10 active:scale-95 text-sm"
                      aria-label={`Increase ${phase.label.toLowerCase()}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedMode && isRunning && (
          <div className="mt-1 flex items-center gap-2 rounded-xl border border-white/12 bg-black/24 px-3 py-2">
            <div className="flex h-2 flex-1 overflow-hidden rounded-full border border-white/10">
              {selectedSegments.map((segment) =>
                segment.value > 0 ? (
                  <div
                    key={segment.key}
                    className={segment.className}
                    style={{ width: `${(segment.value / selectedTotal) * 100}%` }}
                  />
                ) : null,
              )}
            </div>
            <span className="text-[10px] text-white/78 tabular-nums tracking-wider truncate max-w-[45%]">
              {selectedMode.technique.commonName}
            </span>
          </div>
        )}
      </div>

      {selectedMode && (
        <TechniqueScienceSheet
          technique={selectedMode}
          open={scienceOpen}
          onClose={() => setScienceOpen(false)}
        />
      )}
    </>
  );
};

export default TechniquesLibrary;
