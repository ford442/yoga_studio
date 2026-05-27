'use client';

import React from 'react';
import type { SessionMode } from '../types/sessionMode';

interface SessionModeSwitcherProps {
  modes: SessionMode[];
  selectedModeId: string;
  onSelect: (mode: SessionMode) => void;
}

const SessionModeSwitcher: React.FC<SessionModeSwitcherProps> = ({ modes, selectedModeId, onSelect }) => {
  return (
    <div className="w-full">
      <p className="text-[10px] text-white/40 tracking-widest text-center mb-2">SESSION MODE</p>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory">
        {modes.map(mode => {
          const isActive = mode.id === selectedModeId;
          return (
            <button
              key={mode.id}
              onClick={() => onSelect(mode)}
              className={`flex-shrink-0 snap-start flex flex-col items-center gap-1 px-4 py-3 rounded-2xl border transition-all active:scale-95 min-w-[90px] ${
                isActive
                  ? 'bg-white/15 border-white/40 text-white'
                  : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20'
              }`}
            >
              <span className="text-2xl leading-none">{mode.emoji}</span>
              <span className="text-[10px] tracking-wider font-light leading-tight text-center">
                {mode.label.toUpperCase()}
              </span>
              {isActive && (
                <span className="text-[8px] text-white/50 tracking-wider">{mode.chakraFocus}</span>
              )}
            </button>
          );
        })}
      </div>
      {modes.map(mode => mode.id === selectedModeId ? (
        <p key={mode.id} className="text-[10px] text-white/40 text-center mt-2 leading-relaxed px-2">
          {mode.description}
        </p>
      ) : null)}
    </div>
  );
};

export default SessionModeSwitcher;
