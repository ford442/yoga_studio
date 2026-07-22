'use client';

import React from 'react';
import ExportStats from '../../components/ExportStats';

interface StatsHeaderProps {
  todayMinutes: number;
  todayBreaths: number;
  currentStreak: number;
}

export default function StatsHeader({ todayMinutes, todayBreaths, currentStreak }: StatsHeaderProps) {
  return (
    <div className="fixed top-0 inset-x-0 z-20 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2 bg-gradient-to-b from-black/55 to-transparent">
      <div className="max-w-md mx-auto flex items-start justify-between gap-3">
        <div className="rounded-2xl bg-black/20 backdrop-blur-md border border-white/10 px-3 py-2">
          <h1 className="text-lg font-light tracking-[3px] text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.8)]">SACRED BREATH</h1>
          <p className="text-white/75 text-[10px] tracking-widest [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">meditate • align • flow</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-2xl bg-black/20 backdrop-blur-md border border-white/10 px-2.5 py-2 leading-none">
            <div className="text-cyan-300/95 text-sm tabular-nums [text-shadow:0_1px_8px_rgba(0,0,0,0.8)]">{todayMinutes}</div>
            <div className="text-white/75 text-[9px] tracking-wider mt-1 [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">MIN TODAY</div>
          </div>
          <div className="rounded-2xl bg-black/20 backdrop-blur-md border border-white/10 px-2.5 py-2 leading-none">
            <div className="text-purple-300/95 text-sm tabular-nums [text-shadow:0_1px_8px_rgba(0,0,0,0.8)]">{todayBreaths}</div>
            <div className="text-white/75 text-[9px] tracking-wider mt-1 [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">BREATHS</div>
          </div>
          <div className="rounded-2xl bg-black/20 backdrop-blur-md border border-white/10 px-2.5 py-2 leading-none">
            <div className="text-orange-300/95 text-sm tabular-nums [text-shadow:0_1px_8px_rgba(0,0,0,0.8)]">{currentStreak}🔥</div>
            <div className="text-white/75 text-[9px] tracking-wider mt-1 [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">STREAK</div>
          </div>
          <ExportStats todayMinutes={todayMinutes} todayBreaths={todayBreaths} currentStreak={currentStreak} />
        </div>
      </div>
    </div>
  );
}
