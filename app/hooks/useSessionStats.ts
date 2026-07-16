import { useState, useEffect, useCallback } from 'react';

interface SessionStats {
  todayMinutes: number;
  todayBreaths: number;
  currentStreak: number;
  lastPracticeDate: string;
}

const STORAGE_KEY = 'sacred-breath-stats';

const getTodayKey = () => new Date().toISOString().split('T')[0];

const getDefaultStats = (): SessionStats => ({
  todayMinutes: 0,
  todayBreaths: 0,
  currentStreak: 0,
  lastPracticeDate: getTodayKey(),
});

const readStoredStats = (): SessionStats => {
  const today = getTodayKey();
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return { ...getDefaultStats(), lastPracticeDate: today };

  const parsed = JSON.parse(saved) as Partial<SessionStats>;
  if (parsed.lastPracticeDate !== today) {
    return {
      todayMinutes: 0,
      todayBreaths: 0,
      currentStreak: parsed.currentStreak ?? 0,
      lastPracticeDate: parsed.lastPracticeDate ?? today,
    };
  }

  return {
    todayMinutes: parsed.todayMinutes ?? 0,
    todayBreaths: parsed.todayBreaths ?? 0,
    currentStreak: parsed.currentStreak ?? 0,
    lastPracticeDate: parsed.lastPracticeDate ?? today,
  };
};

export const useSessionStats = () => {
  const [stats, setStats] = useState<SessionStats>(getDefaultStats);
  const [hasLoadedStats, setHasLoadedStats] = useState(false);

  useEffect(() => {
    try {
      setStats(readStoredStats());
    } catch {
      console.warn('Invalid sacred-breath-stats localStorage payload');
      setStats(getDefaultStats());
    } finally {
      setHasLoadedStats(true);
    }
  }, []);

  // Save to localStorage whenever stats change
  useEffect(() => {
    if (!hasLoadedStats) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  }, [hasLoadedStats, stats]);

  const addPracticeTime = useCallback((seconds: number) => {
    const today = getTodayKey();

    setStats((prev) => {
      const newMinutes = prev.todayMinutes + Math.round(seconds / 60);
      const newBreaths = prev.todayBreaths + 1;
      const isNewDay = prev.lastPracticeDate !== today;

      // Update streak
      let newStreak = prev.currentStreak;
      if (isNewDay) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        if (prev.lastPracticeDate === yesterday) {
          newStreak = prev.currentStreak + 1;
        } else if (prev.lastPracticeDate !== today) {
          newStreak = 1; // reset streak if gap
        }
      }

      return {
        todayMinutes: newMinutes,
        todayBreaths: newBreaths,
        currentStreak: newStreak,
        lastPracticeDate: today,
      };
    });
  }, []);

  const resetStats = () => {
    const today = getTodayKey();
    setStats({
      todayMinutes: 0,
      todayBreaths: 0,
      currentStreak: 0,
      lastPracticeDate: today,
    });
  };

  return {
    stats,
    addPracticeTime,
    resetStats,
  };
};
