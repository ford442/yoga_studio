'use client';

import { useCallback, useEffect, useState } from 'react';
import type { EnvironmentId, EnvironmentOverride } from '../types/environment';
import { DEFAULT_ENVIRONMENT_ID, isEnvironmentId } from '../data/environments';

import { safeGetItem, safeSetItem } from '../lib/safeStorage';

const STORAGE_KEY = 'sacred-breath-environment';

const isEnvironmentOverride = (value: unknown): value is EnvironmentOverride =>
  value === 'auto' || isEnvironmentId(value);

const readStoredOverride = (): EnvironmentOverride => {
  const raw = safeGetItem(STORAGE_KEY);
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
  const [override, setOverrideState] = useState<EnvironmentOverride>('auto');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOverrideState(readStoredOverride());
  }, []);

  const setOverride = useCallback((next: EnvironmentOverride) => {
    setOverrideState(next);
    safeSetItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const activeId: EnvironmentId =
    override === 'auto'
      ? modeBackgroundId ?? DEFAULT_ENVIRONMENT_ID
      : override;

  return { override, activeId, setOverride };
}
