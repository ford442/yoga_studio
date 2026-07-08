'use client';

import { useCallback, useEffect, useState } from 'react';
import { ONBOARDING_STORAGE_KEY } from '../data/onboarding';

export interface OnboardingState {
  skipForever: boolean;
  hasDismissedWelcome: boolean;
  hasCompletedFirstSession: boolean;
  hasSeenIntroTour: boolean;
}

const DEFAULT_STATE: OnboardingState = {
  skipForever: false,
  hasDismissedWelcome: false,
  hasCompletedFirstSession: false,
  hasSeenIntroTour: false,
};

const parseState = (raw: unknown): OnboardingState => {
  if (!raw || typeof raw !== 'object') return DEFAULT_STATE;
  const data = raw as Partial<OnboardingState>;
  return {
    skipForever: Boolean(data.skipForever),
    hasDismissedWelcome: Boolean(data.hasDismissedWelcome),
    hasCompletedFirstSession: Boolean(data.hasCompletedFirstSession),
    hasSeenIntroTour: Boolean(data.hasSeenIntroTour),
  };
};

const readStoredState = (): OnboardingState => {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
  if (!raw) return DEFAULT_STATE;
  try {
    return parseState(JSON.parse(raw));
  } catch {
    console.warn('Invalid sacred-breath-onboarding localStorage payload');
    return DEFAULT_STATE;
  }
};

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate onboarding flags from localStorage on mount
    setState(readStoredState());
    setHasLoaded(true);
  }, []);

  const patch = useCallback(
    (partial: Partial<OnboardingState>) => {
      setState((prev) => {
        const next = { ...prev, ...partial };
        localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  const dismissWelcome = useCallback(
    (forever = false) => {
      patch({
        hasDismissedWelcome: true,
        ...(forever ? { skipForever: true } : {}),
      });
    },
    [patch],
  );

  const markIntroTourSeen = useCallback(() => {
    patch({ hasSeenIntroTour: true });
  }, [patch]);

  const markFirstSessionComplete = useCallback(() => {
    patch({ hasCompletedFirstSession: true, hasDismissedWelcome: true });
  }, [patch]);

  const shouldShowWelcome = hasLoaded && !state.skipForever && !state.hasDismissedWelcome;

  return {
    ...state,
    hasLoaded,
    shouldShowWelcome,
    dismissWelcome,
    markIntroTourSeen,
    markFirstSessionComplete,
    patch,
  };
}
