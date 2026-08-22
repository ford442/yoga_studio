'use client';

import { useEffect, useState } from 'react';
import { safeGetItem, safeSetItem } from '../lib/safeStorage';

export type QuickStartDuration = 'free' | 5 | 10 | 15;
export type LastSession = { modeId: string; duration: QuickStartDuration };

const STORAGE_KEY = 'sacred-breath-last-session';

export function useLastSession() {
  const [lastSession, setLastSession] = useState<LastSession | null>(null);

  useEffect(() => {
    const raw = safeGetItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.modeId === 'string' &&
        (parsed.duration === 'free' || parsed.duration === 5 || parsed.duration === 10 || parsed.duration === 15)
      ) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate last session from localStorage on mount
        setLastSession(parsed as LastSession);
      }
    } catch {
      console.warn('Invalid sacred-breath-last-session localStorage payload');
    }
  }, []);

  const persistLastSession = (modeId: string, duration: QuickStartDuration) => {
    const next: LastSession = { modeId, duration };
    setLastSession(next);
    safeSetItem(STORAGE_KEY, JSON.stringify(next));
  };

  return { lastSession, persistLastSession };
}
