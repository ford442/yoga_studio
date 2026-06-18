'use client';

import React from 'react';
import type { SessionMode } from '../types/sessionMode';
import type { BreathSettings } from '../hooks/useBreathTimer';

interface SessionModeSwitcherProps {
  modes: SessionMode[];
  selectedModeId: string;
  isRunning: boolean;
  activeBreath: BreathSettings;
  favoriteModeIds: string[];
  onSelect: (mode: SessionMode) => void;
  onStart: (mode: SessionMode, duration: 'free' | 5 | 10 | 15) => void;
  onNudge: (key: 'inhale' | 'exhale', delta: number) => void;
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

const SessionModeSwitcher: React.FC<SessionModeSwitcherProps> = ({
  modes,
  selectedModeId,
  isRunning,
  activeBreath,
  favoriteModeIds,
  onSelect,
  onStart,
  onNudge,
  onToggleFavorite,
}) => {
  const [rippleModeId, setRippleModeId] = React.useState<string | null>(null);
  const [rippleToken, setRippleToken] = React.useState(0);

  const handleSelect = (mode: SessionMode) => {
    setRippleModeId(mode.id);
    setRippleToken(prev => prev + 1);
    onSelect(mode);
  };

  return (
    <div className="w-full rounded-2xl bg-black/20 backdrop-blur-md border border-white/10 px-2.5 py-2">
      <p className="text-[10px] text-white/80 tracking-widest text-center mb-2 [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">SESSION MODE</p>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory">
        {modes.map(mode => {
          const isActive = mode.id === selectedModeId;
          const isFavorite = favoriteModeIds.includes(mode.id);
          const accent = mode.accentColor ?? FALLBACK_ACCENTS[mode.chakraFocusIndex] ?? FALLBACK_ACCENTS[-1];
          const [r, g, b] = hexToRgb(accent);
          const breath = isActive ? activeBreath : mode.breath;
          const segments = [
            { key: 'inhale', value: breath.inhale, className: 'bg-cyan-400' },
            { key: 'hold1', value: breath.hold1, className: 'bg-purple-400' },
            { key: 'exhale', value: breath.exhale, className: 'bg-orange-400' },
            { key: 'hold2', value: breath.hold2, className: 'bg-violet-400' },
          ];
          const total = Math.max(1, segments.reduce((sum, seg) => sum + seg.value, 0));
          const cardStyle = isActive
            ? ({
                ['--mode-accent' as string]: accent,
                boxShadow: `0 0 12px 2px rgba(${r}, ${g}, ${b}, 0.5)`,
              } as React.CSSProperties)
            : undefined;
          const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            handleSelect(mode);
          };

          return (
            <div
              key={mode.id}
              role="button"
              tabIndex={0}
              onClick={() => handleSelect(mode)}
              onKeyDown={handleCardKeyDown}
              style={cardStyle}
              className={`relative overflow-hidden flex-shrink-0 snap-start flex flex-col items-center gap-1 px-4 py-3 rounded-2xl transition-all duration-300 active:scale-90 min-w-[90px] backdrop-blur-sm ${
                isActive
                  ? 'mode-card-active border-2 border-transparent scale-105 bg-black/35 text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]'
                  : 'border border-white/15 text-white/80 bg-black/20 opacity-60 [filter:grayscale(0.4)] hover:opacity-90 hover:bg-black/30 hover:border-white/30 [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]'
              }`}
            >
              {rippleModeId === mode.id && (
                <span
                  key={`${mode.id}-${rippleToken}`}
                  className="mode-card-ripple pointer-events-none absolute inset-0 rounded-2xl"
                />
              )}
              <span className="text-2xl leading-none">{mode.emoji}</span>
              <span className="text-[10px] tracking-wider font-light leading-tight text-center">
                {mode.label.toUpperCase()}
              </span>
              {isActive && (
                <span className="text-[8px] text-white/75 tracking-wider">{mode.chakraFocus}</span>
              )}
              {isActive && !isRunning && (
                <div className="w-full mt-2 space-y-2 text-left">
                  <div className="flex items-center gap-2">
                    <div className="flex h-1.5 flex-1 overflow-hidden rounded-full border border-white/10">
                      {segments.map((segment) => segment.value > 0 ? (
                        <div
                          key={segment.key}
                          className={segment.className}
                          style={{ width: `${(segment.value / total) * 100}%` }}
                        />
                      ) : null)}
                    </div>
                    <span className="text-[9px] text-white/80 tabular-nums tracking-wider">
                      {breath.inhale}-{breath.hold1}-{breath.exhale}-{breath.hold2}
                    </span>
                  </div>

                  <div className="flex gap-1.5">
                    {(['free', 5, 10, 15] as const).map((duration) => (
                      <button
                        key={duration}
                        onClick={(e) => {
                          e.stopPropagation();
                          onStart(mode, duration);
                        }}
                        className="flex-1 py-1.5 rounded-lg bg-white/12 border border-white/15 text-[9px] tracking-wider hover:bg-white/20 active:scale-90 transition-all"
                      >
                        {duration === 'free' ? 'FREE' : `${duration} MIN`}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 text-[9px]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNudge('inhale', -1);
                      }}
                      className="px-2 py-1 rounded-md bg-white/10 border border-white/10 active:scale-90"
                      aria-label="Decrease inhale"
                    >
                      I−
                    </button>
                    <span className="text-white/80 tabular-nums">I {activeBreath.inhale}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNudge('inhale', 1);
                      }}
                      className="px-2 py-1 rounded-md bg-white/10 border border-white/10 active:scale-90"
                      aria-label="Increase inhale"
                    >
                      I+
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNudge('exhale', -1);
                      }}
                      className="px-2 py-1 rounded-md bg-white/10 border border-white/10 active:scale-90"
                      aria-label="Decrease exhale"
                    >
                      E−
                    </button>
                    <span className="text-white/80 tabular-nums">E {activeBreath.exhale}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNudge('exhale', 1);
                      }}
                      className="px-2 py-1 rounded-md bg-white/10 border border-white/10 active:scale-90"
                      aria-label="Increase exhale"
                    >
                      E+
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(mode.id);
                      }}
                      className="ml-auto px-2 py-1 rounded-md bg-white/10 border border-white/10 active:scale-90"
                      aria-label={isFavorite ? 'Unfavorite mode' : 'Favorite mode'}
                    >
                      {isFavorite ? '★' : '☆'}
                    </button>
                  </div>

                  <p className="text-[9px] text-white/75 leading-relaxed">
                    {mode.description}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SessionModeSwitcher;
