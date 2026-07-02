'use client';

import React from 'react';
import type { SessionMode } from '../types/sessionMode';
import type { BreathSettings } from '../hooks/useBreathTimer';

type BreathSettingKey = keyof BreathSettings;

interface SessionModeSwitcherProps {
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

const SessionModeSwitcher: React.FC<SessionModeSwitcherProps> = ({
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
  const [rippleModeId, setRippleModeId] = React.useState<string | null>(null);
  const [rippleToken, setRippleToken] = React.useState(0);
  const selectedMode = modes.find(mode => mode.id === selectedModeId) ?? modes[0];
  const selectedAccent = selectedMode ? getModeAccent(selectedMode) : FALLBACK_ACCENTS[-1];
  const selectedSegments = getSegments(activeBreath);
  const selectedTotal = Math.max(1, selectedSegments.reduce((sum, seg) => sum + seg.value, 0));
  const selectedIsFavorite = selectedMode ? favoriteModeIds.includes(selectedMode.id) : false;

  const handleSelect = (mode: SessionMode) => {
    setRippleModeId(mode.id);
    setRippleToken(prev => prev + 1);
    onSelect(mode);
  };

  return (
    <div
      className="w-full rounded-2xl bg-black/28 backdrop-blur-md border border-white/15 px-3 py-3 shadow-2xl shadow-black/25"
      style={{ ['--mode-accent' as string]: selectedAccent } as React.CSSProperties}
    >
      {selectedMode && (
        <div className="relative overflow-hidden rounded-xl border border-white/15 bg-black/35 px-3 py-3 mb-3">
          <div className="absolute left-0 top-0 h-full w-1.5 bg-[var(--mode-accent)] shadow-[0_0_18px_var(--mode-accent)]" />
          <div className="pl-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] text-white/70 tracking-[0.22em] [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">
                  PRACTICE MODE
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-2xl leading-none">{selectedMode.emoji}</span>
                  <h2 className="text-lg leading-tight font-light text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]">
                    {selectedMode.label}
                  </h2>
                </div>
              </div>
              <div className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-[10px] tracking-wider text-white/85 tabular-nums">
                {activeBreath.inhale}-{activeBreath.hold1}-{activeBreath.exhale}-{activeBreath.hold2}
              </div>
            </div>
            <p className="mt-2 text-[11px] text-white/78 leading-relaxed [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">
              {selectedMode.description}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-[10px] text-white/75 tracking-[0.22em] [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">
          ROUTINES
        </p>
        <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
      </div>

      <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
        {modes.map(mode => {
          const isActive = mode.id === selectedModeId;
          const isFavorite = favoriteModeIds.includes(mode.id);
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
              className={`relative overflow-hidden flex-shrink-0 snap-start flex min-h-[94px] w-[142px] flex-col items-start gap-1 rounded-xl px-3 py-3 text-left transition-all duration-300 active:scale-95 backdrop-blur-sm ${
                isActive
                  ? 'mode-card-active border-2 border-[var(--mode-accent)] bg-white/16 text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.85)]'
                  : 'border border-white/15 text-white/82 bg-black/22 hover:bg-black/35 hover:border-white/35 [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]'
              }`}
            >
              {rippleModeId === mode.id && (
                <span
                  key={`${mode.id}-${rippleToken}`}
                  className="mode-card-ripple pointer-events-none absolute inset-0 rounded-xl"
                />
              )}
              <span className="absolute inset-x-0 top-0 h-1 bg-[var(--mode-accent)]" />
              <span className="flex w-full items-start justify-between gap-2">
                <span className="text-2xl leading-none">{mode.emoji}</span>
                {isActive ? (
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--mode-accent)] text-sm text-white shadow-[0_0_14px_var(--mode-accent)]">
                    ✓
                  </span>
                ) : isFavorite ? (
                  <span className="text-sm text-white/65">★</span>
                ) : null}
              </span>
              <span className="text-[12px] font-medium leading-tight text-white">
                {mode.label}
              </span>
              <span className="text-[9px] text-white/65 tracking-wider uppercase">{mode.chakraFocus}</span>
              <span className="mt-auto text-[10px] text-white/78 tabular-nums tracking-wider">
                {breath.inhale}-{breath.hold1}-{breath.exhale}-{breath.hold2}
              </span>
            </button>
          );
        })}
      </div>

      {selectedMode && !isRunning && (
        <div className="mt-1 rounded-xl border border-white/12 bg-black/24 px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-2 flex-1 overflow-hidden rounded-full border border-white/10">
              {selectedSegments.map(segment => segment.value > 0 ? (
                <div
                  key={segment.key}
                  className={segment.className}
                  style={{ width: `${(segment.value / selectedTotal) * 100}%` }}
                />
              ) : null)}
            </div>
            <button
              onClick={() => onToggleFavorite(selectedMode.id)}
              className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 border border-white/12 active:scale-90 text-sm"
              aria-label={selectedIsFavorite ? 'Unfavorite mode' : 'Favorite mode'}
            >
              {selectedIsFavorite ? '★' : '☆'}
            </button>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {(['free', 5, 10, 15] as const).map(duration => (
              <button
                key={duration}
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
                    <span className="text-[9px] uppercase tracking-wider text-white/70">{phase.label}</span>
                  </div>
                  <span className="text-[9px] text-white/45">{phase.shortLabel}</span>
                </div>
                <div className="grid grid-cols-[2rem_1fr_2rem] gap-1.5">
                  <button
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
                    onChange={(event) => onSetPhaseDuration(phase.key, Number.parseInt(event.target.value, 10))}
                    onBlur={(event) => onSetPhaseDuration(phase.key, Number.parseInt(event.target.value, 10))}
                    className="min-h-8 w-full rounded-md border border-white/10 bg-black/28 px-2 text-center text-[12px] text-white tabular-nums outline-none focus:border-white/35"
                  />
                  <button
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
            {selectedSegments.map(segment => segment.value > 0 ? (
              <div
                key={segment.key}
                className={segment.className}
                style={{ width: `${(segment.value / selectedTotal) * 100}%` }}
              />
            ) : null)}
          </div>
          <span className="text-[10px] text-white/78 tabular-nums tracking-wider">
            {activeBreath.inhale}-{activeBreath.hold1}-{activeBreath.exhale}-{activeBreath.hold2}
          </span>
        </div>
      )}
    </div>
  );
};

export default SessionModeSwitcher;
