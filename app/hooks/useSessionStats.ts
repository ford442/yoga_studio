import { useState, useEffect, useCallback } from 'react';

interface SessionStats {
  todayMinutes: number;
  todayBreaths: number;
  currentStreak: number;
  lastPracticeDate: string;
}

const STORAGE_KEY = 'sacred-breath-stats';

const getTodayKey = () => new Date().toISOString().split('T')[0];

export const useSessionStats = () => {
  const [stats, setStats] = useState<SessionStats>({
    todayMinutes: 0,
    todayBreaths: 0,
    currentStreak: 0,
    lastPracticeDate: '',
  });

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const today = getTodayKey();

      // Reset daily counters if new day
      if (parsed.lastPracticeDate !== today) {
        setStats({
          todayMinutes: 0,
          todayBreaths: 0,
          currentStreak: parsed.currentStreak,
          lastPracticeDate: today,
        });
      } else {
        setStats(parsed);
      }
    }
  }, []);

  // Save to localStorage whenever stats change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  }, [stats]);

  const addPracticeTime = useCallback((seconds: number) => {
    const today = getTodayKey();
    const isNewDay = stats.lastPracticeDate !== today;

    setStats((prev) => {
      const newMinutes = prev.todayMinutes + Math.round(seconds / 60);
      const newBreaths = prev.todayBreaths + 1;

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
  }, [stats.lastPracticeDate, stats.currentStreak]);

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
