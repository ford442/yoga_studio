'use client';

import React from 'react';
import ProgramNextSessionCard from '../../components/ProgramNextSessionCard';
import SessionModeSwitcher from '../../components/SessionModeSwitcher';
import type { BreathSettings } from '../../hooks/useBreathTimer';
import type { LastSession, QuickStartDuration } from '../../hooks/useLastSession';
import type { SessionMode } from '../../types/sessionMode';
import type { ActiveProgramProgress } from '../../types/program';
import { SESSION_MODES } from '../../data/sessionModes';

interface SessionControlsProps {
  isRunning: boolean;
  lastSession: LastSession | null;
  onResumeLastSession: (mode: SessionMode, duration: QuickStartDuration) => void;

  activeProgramId: string | null;
  programProgress: ActiveProgramProgress | null;
  onOpenProgramSelector: () => void;
  onStartProgramSession: (programId: string, dayIndex: number) => void;

  sortedModes: SessionMode[];
  selectedMode: SessionMode;
  settings: BreathSettings;
  favoriteModeIds: string[];
  onModeSelect: (mode: SessionMode) => void;
  onModeStart: (mode: SessionMode, duration: QuickStartDuration) => void;
  onNudge: (key: keyof BreathSettings, delta: number) => void;
  onSetPhaseDuration: (key: keyof BreathSettings, value: number) => void;
  onToggleFavorite: (modeId: string) => void;

  onQuickStart: (duration: 5 | 10 | 15) => void;
  onBeginPause: () => void;
  onReset: () => void;

  voiceEnabled: boolean;
  useSanskrit: boolean;
  onToggleVoice: () => void;
  onToggleSanskrit: () => void;

  canUseInstructor: boolean;
  instructorEnabled: boolean;
  onToggleInstructor: () => void;

  onOpenSettings: () => void;
}

export default function SessionControls({
  isRunning,
  lastSession,
  onResumeLastSession,
  activeProgramId,
  programProgress,
  onOpenProgramSelector,
  onStartProgramSession,
  sortedModes,
  selectedMode,
  settings,
  favoriteModeIds,
  onModeSelect,
  onModeStart,
  onNudge,
  onSetPhaseDuration,
  onToggleFavorite,
  onQuickStart,
  onBeginPause,
  onReset,
  voiceEnabled,
  useSanskrit,
  onToggleVoice,
  onToggleSanskrit,
  canUseInstructor,
  instructorEnabled,
  onToggleInstructor,
  onOpenSettings,
}: SessionControlsProps) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-20 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/70 to-transparent backdrop-blur-md">
      <div className="max-w-md mx-auto flex flex-col gap-3">
        {!isRunning && lastSession && (
          <button
            onClick={() => {
              const mode = SESSION_MODES.find((entry) => entry.id === lastSession.modeId);
              if (!mode) return;
              onResumeLastSession(mode, lastSession.duration);
            }}
            className="w-full py-2 rounded-xl bg-black/25 border border-white/20 hover:bg-black/35 transition-all text-[10px] tracking-widest text-white/90 [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]"
          >
            ↻ RESUME {SESSION_MODES.find((entry) => entry.id === lastSession.modeId)?.technique.commonName.toUpperCase() ?? 'LAST TECHNIQUE'} · {lastSession.duration === 'free' ? 'FREE' : `${lastSession.duration} MIN`}
          </button>
        )}

        <ProgramNextSessionCard
          activeProgramId={activeProgramId}
          activeProgress={programProgress}
          isRunning={isRunning}
          onOpenSelector={onOpenProgramSelector}
          onStartSession={onStartProgramSession}
        />

        <SessionModeSwitcher
          modes={sortedModes}
          selectedModeId={selectedMode.id}
          isRunning={isRunning}
          activeBreath={settings}
          favoriteModeIds={favoriteModeIds}
          onSelect={onModeSelect}
          onStart={onModeStart}
          onNudge={onNudge}
          onSetPhaseDuration={onSetPhaseDuration}
          onToggleFavorite={onToggleFavorite}
        />

        <div className="flex gap-2">
          {[5, 10, 15].map((min) => (
            <button
              key={min}
              onClick={() => onQuickStart(min as 5 | 10 | 15)}
              className="flex-1 py-3 bg-black/20 backdrop-blur-md hover:bg-black/30 border border-white/20 rounded-2xl text-xs tracking-widest transition-all active:scale-95 text-white/95 [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]"
            >
              {min} MIN
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onBeginPause}
            className="flex-1 py-4 text-base font-light tracking-widest bg-gradient-to-r from-cyan-500 to-purple-600 rounded-3xl hover:brightness-110 transition-all active:scale-95 shadow-2xl shadow-purple-500/30 text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]"
          >
            {isRunning ? 'PAUSE' : 'BEGIN'}
          </button>
          <button onClick={onReset} className="px-4 py-4 text-sm font-light tracking-widest border border-white/30 rounded-3xl bg-black/20 backdrop-blur-md hover:bg-black/30 transition-all text-white/95 [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">
            ↺
          </button>
          <button
            onClick={onToggleVoice}
            className={`px-4 py-4 text-xl border rounded-3xl transition-all backdrop-blur-md [text-shadow:0_1px_6px_rgba(0,0,0,0.8)] ${voiceEnabled ? 'bg-black/20 border-white/30 hover:bg-black/30' : 'bg-black/10 border-white/10 opacity-40'}`}
            title={voiceEnabled ? 'Voice guidance on' : 'Voice guidance off'}
          >
            🗣️
          </button>
          <button
            onClick={onToggleSanskrit}
            className={`px-4 py-4 text-xs font-light border rounded-3xl transition-all backdrop-blur-md [text-shadow:0_1px_6px_rgba(0,0,0,0.8)] ${useSanskrit ? 'bg-black/30 border-purple-300 text-purple-200' : 'bg-black/20 border-white/30 hover:bg-black/30 text-white/95'}`}
            title={useSanskrit ? 'Sanskrit mode' : 'English mode'}
          >
            {useSanskrit ? 'सं' : 'EN'}
          </button>
          {canUseInstructor && (
            <button
              onClick={onToggleInstructor}
              className={`px-4 py-4 text-xl border rounded-3xl transition-all backdrop-blur-md [text-shadow:0_1px_6px_rgba(0,0,0,0.8)] ${
                instructorEnabled
                  ? 'bg-cyan-500/25 border-cyan-300/60 text-cyan-100'
                  : 'bg-black/20 border-white/30 hover:bg-black/30 text-white/95 opacity-60'
              }`}
              title={instructorEnabled ? 'Hide instructor guide' : 'Show instructor guide'}
            >
              🧘
            </button>
          )}
          <button onClick={onOpenSettings} className="px-4 py-4 text-xl border border-white/30 rounded-3xl bg-black/20 backdrop-blur-md hover:bg-black/30 transition-all text-white/95 [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">
            ⚙️
          </button>
        </div>
      </div>
    </div>
  );
}
