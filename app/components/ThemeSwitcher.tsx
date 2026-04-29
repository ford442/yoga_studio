'use client';

import React from 'react';

const themes = [
  { id: 0, label: 'COSMIC', emoji: '🌌' },
  { id: 1, label: 'GOLDEN', emoji: '🌅' },
  { id: 2, label: 'OCEAN', emoji: '🌊' },
];

const styles = [
  { id: 0, label: 'Lotus' },
  { id: 1, label: 'Yantra' },
  { id: 2, label: 'Flower' },
];

interface ThemeSwitcherProps {
  theme: number;
  mandalaStyle: number;
  onThemeChange: (t: number) => void;
  onStyleChange: (s: number) => void;
}

const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ theme, mandalaStyle, onThemeChange, onStyleChange }) => {
  return (
    <div className="flex flex-col gap-3 items-center">
      <div className="flex gap-2">
        {themes.map(t => (
          <button
            key={t.id}
            onClick={() => onThemeChange(t.id)}
            className={`px-5 py-2 text-xs tracking-widest rounded-3xl transition-all ${theme === t.id ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/20'}`}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        {styles.map(s => (
          <button
            key={s.id}
            onClick={() => onStyleChange(s.id)}
            className={`px-4 py-1.5 text-xs tracking-widest rounded-3xl transition-all ${mandalaStyle === s.id ? 'bg-purple-500/30 border border-purple-400' : 'bg-white/10 hover:bg-white/20'}`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ThemeSwitcher;
