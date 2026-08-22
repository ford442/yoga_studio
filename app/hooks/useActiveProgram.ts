import { useCallback, useEffect, useState } from 'react';
import type { ActiveProgramProgress } from '../types/program';
import { safeGetItem, safeRemoveItem, safeSetItem } from '../lib/safeStorage';

const STORAGE_KEY = 'sacred-breath-active-program';

const getTodayKey = () => new Date().toISOString().split('T')[0];

const getDefaultProgress = (programId: string): ActiveProgramProgress => ({
  programId,
  startDate: getTodayKey(),
  completedDays: [],
});

const parseProgress = (raw: unknown): ActiveProgramProgress | null => {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<ActiveProgramProgress>;
  if (typeof data.programId !== 'string' || !Array.isArray(data.completedDays)) return null;
  return {
    programId: data.programId,
    startDate: typeof data.startDate === 'string' ? data.startDate : getTodayKey(),
    completedDays: data.completedDays.filter((d): d is number => typeof d === 'number' && Number.isInteger(d)),
    lastCompletedAt: typeof data.lastCompletedAt === 'string' ? data.lastCompletedAt : undefined,
  };
};

const readStoredProgress = (): ActiveProgramProgress | null => {
  if (typeof window === 'undefined') return null;
  const raw = safeGetItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const progress = parseProgress(JSON.parse(raw) as unknown);
    if (!progress) {
      console.warn('Invalid sacred-breath-active-program localStorage payload');
    }
    return progress;
  } catch {
    console.warn('Invalid sacred-breath-active-program localStorage payload');
    return null;
  }
};

const writeStoredProgress = (progress: ActiveProgramProgress | null): void => {
  if (typeof window === 'undefined') return;
  if (progress === null) {
    safeRemoveItem(STORAGE_KEY);
    return;
  }
  safeSetItem(STORAGE_KEY, JSON.stringify(progress));
};

export function useActiveProgram() {
  const [progress, setProgress] = useState<ActiveProgramProgress | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate active program from localStorage on mount
    setProgress(readStoredProgress());
    setHasLoaded(true);
  }, []);

  // Persist to localStorage whenever progress changes.
  useEffect(() => {
    if (!hasLoaded) return;
    writeStoredProgress(progress);
  }, [hasLoaded, progress]);

  const selectProgram = useCallback((programId: string) => {
    const next = getDefaultProgress(programId);
    setProgress(next);
  }, []);

  const completeDay = useCallback((dayIndex: number) => {
    setProgress((prev) => {
      if (!prev) return prev;
      if (prev.completedDays.includes(dayIndex)) return prev;
      return {
        ...prev,
        completedDays: [...prev.completedDays, dayIndex].sort((a, b) => a - b),
        lastCompletedAt: new Date().toISOString(),
      };
    });
  }, []);

  const abandonProgram = useCallback(() => {
    setProgress(null);
  }, []);

  const resetProgram = useCallback(() => {
    setProgress((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        completedDays: [],
        lastCompletedAt: undefined,
      };
    });
  }, []);

  return {
    activeProgramId: progress?.programId ?? null,
    progress,
    hasLoaded,
    selectProgram,
    completeDay,
    abandonProgram,
    resetProgram,
  };
}
