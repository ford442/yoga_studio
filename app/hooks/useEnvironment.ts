'use client';

import { useCallback, useState } from 'react';
import type { EnvironmentId, EnvironmentOverride } from '../types/environment';
import { DEFAULT_ENVIRONMENT_ID, isEnvironmentId } from '../data/environments';

const STORAGE_KEY = 'sacred-breath-environment';

const isEnvironmentOverride = (value: unknown): value is EnvironmentOverride =>
  value === 'auto' || isEnvironmentId(value);

const readStoredOverride = (): EnvironmentOverride => {
  if (typeof window === 'undefined') return 'auto';
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return 'auto';
  try {
    const parsed = JSON.parse(raw);
    if (isEnvironmentOverride(parsed)) return parsed;
  } catch {
    console.warn('Invalid sacred-breath-environment localStorage payload');
  }
  return 'auto';
};

export function useEnvironment(modeBackgroundId?: EnvironmentId) {
  const [override, setOverrideState] = useState<EnvironmentOverride>(readStoredOverride);

  const setOverride = useCallback((next: EnvironmentOverride) => {
    setOverrideState(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const activeId: EnvironmentId =
    override === 'auto'
      ? modeBackgroundId ?? DEFAULT_ENVIRONMENT_ID
      : override;

  return { override, activeId, setOverride };
}
