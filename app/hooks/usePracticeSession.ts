'use client';

import { useEffect, useMemo, useState } from 'react';
import type { BreathSettings, SessionDuration } from './useBreathTimer';
import type { QuickStartDuration } from './useLastSession';
import type { ActiveProgramSession } from './useSessionCompletion';
import { SESSION_MODES, DEFAULT_MODE } from '../data/sessionModes';
import { getProgramById, resolveProgramSessionTechnique } from '../data/programs';
import { BEGINNER_SESSION_MINUTES, getBeginnerMode } from '../data/onboarding';
import type { SessionMode } from '../types/sessionMode';
import { safeGetItem, safeSetItem } from '../lib/safeStorage';

interface UsePracticeSessionOptions {
  settings: BreathSettings;
  isRunning: boolean;
  startSession: (minutes: SessionDuration) => void;
  toggleFree: () => void;
  updateSettings: (next: Partial<BreathSettings>) => void;
  persistLastSession: (modeId: string, duration: QuickStartDuration) => void;
  canUseInstructor: boolean;
  enableInstructor: () => void;
  dismissWelcome: (forever?: boolean) => void;
}

/** Owns technique selection, favorites, and the handlers that start free/timed/program sessions. */
export function usePracticeSession({
  settings,
  isRunning,
  startSession,
  toggleFree,
  updateSettings,
  persistLastSession,
  canUseInstructor,
  enableInstructor,
  dismissWelcome,
}: UsePracticeSessionOptions) {
  const [selectedMode, setSelectedMode] = useState<SessionMode>(DEFAULT_MODE);
  const [favoriteModeIds, setFavoriteModeIds] = useState<string[]>([]);
  const [isBeginnerSession, setIsBeginnerSession] = useState(false);
  const [activeProgramSession, setActiveProgramSession] = useState<ActiveProgramSession | null>(null);

  useEffect(() => {
    const rawFavorites = safeGetItem('sacred-breath-favorites');
    if (!rawFavorites) return;
    try {
      const parsed = JSON.parse(rawFavorites);
      if (Array.isArray(parsed)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate favorites from localStorage on mount
        setFavoriteModeIds(parsed.filter((id): id is string => typeof id === 'string'));
      }
    } catch {
      console.warn('Invalid sacred-breath-favorites localStorage payload');
    }
  }, []);

  const sortedModes = useMemo(() => {
    if (!favoriteModeIds.length) return SESSION_MODES;
    const favoriteSet = new Set(favoriteModeIds);
    return [...SESSION_MODES].sort((a, b) => {
      const aFav = favoriteSet.has(a.id) ? 1 : 0;
      const bFav = favoriteSet.has(b.id) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      return SESSION_MODES.findIndex((mode) => mode.id === a.id) - SESSION_MODES.findIndex((mode) => mode.id === b.id);
    });
  }, [favoriteModeIds]);

  const handleModeSelect = (mode: SessionMode) => {
    setSelectedMode(mode);
    updateSettings(mode.breath);
  };

  const handleModeStart = (mode: SessionMode, duration: QuickStartDuration) => {
    setSelectedMode(mode);
    updateSettings(mode.breath);
    persistLastSession(mode.id, duration);
    setActiveProgramSession(null);
    if (duration === 'free') {
      if (!isRunning) toggleFree();
      return;
    }
    startSession(duration);
  };

  const handleStartProgramSession = (programId: string, dayIndex: number) => {
    const program = getProgramById(programId);
    if (!program) return;
    const day = program.days[dayIndex];
    if (!day || day.type !== 'session') return;

    const technique = resolveProgramSessionTechnique(day, SESSION_MODES);
    setActiveProgramSession({ programId, dayIndex });
    setSelectedMode(technique);
    updateSettings(technique.breath);
    persistLastSession(technique.id, day.durationMinutes);
    if (day.durationMinutes === 'free') {
      if (!isRunning) toggleFree();
      return;
    }
    startSession(day.durationMinutes);
  };

  const handleQuickStart = (duration: 5 | 10 | 15) => {
    persistLastSession(selectedMode.id, duration);
    setActiveProgramSession(null);
    startSession(duration);
  };

  const handleBeginPause = () => {
    if (!isRunning) {
      persistLastSession(selectedMode.id, 'free');
    }
    setActiveProgramSession(null);
    toggleFree();
  };

  const launchBeginnerSession = () => {
    const mode = getBeginnerMode();
    setIsBeginnerSession(true);
    setSelectedMode(mode);
    updateSettings(mode.breath);
    if (canUseInstructor) {
      enableInstructor();
    }
    persistLastSession(mode.id, BEGINNER_SESSION_MINUTES);
    setActiveProgramSession(null);
    dismissWelcome(false);
    startSession(BEGINNER_SESSION_MINUTES);
  };

  const handleNudge = (key: keyof BreathSettings, delta: number) => {
    const min = key === 'inhale' || key === 'exhale' ? 1 : 0;
    const max = key === 'hold2' ? 10 : 15;
    const next = Math.max(min, Math.min(max, settings[key] + delta));
    updateSettings({ [key]: next });
  };

  const handleSetPhaseDuration = (key: keyof BreathSettings, value: number) => {
    const min = key === 'inhale' || key === 'exhale' ? 1 : 0;
    const max = key === 'hold2' ? 10 : 15;
    const next = Math.max(min, Math.min(max, Number.isFinite(value) ? value : settings[key]));
    updateSettings({ [key]: next });
  };

  const toggleFavoriteMode = (modeId: string) => {
    setFavoriteModeIds((prev) => {
      const next = prev.includes(modeId)
        ? prev.filter((id) => id !== modeId)
        : [...prev, modeId];
      safeSetItem('sacred-breath-favorites', JSON.stringify(next));
      return next;
    });
  };

  return {
    selectedMode,
    sortedModes,
    favoriteModeIds,
    setFavoriteModeIds,
    isBeginnerSession,
    setIsBeginnerSession,
    activeProgramSession,
    setActiveProgramSession,
    handleModeSelect,
    handleModeStart,
    handleStartProgramSession,
    handleQuickStart,
    handleBeginPause,
    launchBeginnerSession,
    handleNudge,
    handleSetPhaseDuration,
    toggleFavoriteMode,
  };
}
