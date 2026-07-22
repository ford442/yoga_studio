'use client';

import { useState } from 'react';

interface UseIntroTourFlowOptions {
  markIntroTourSeen: () => void;
  launchBeginnerSession: () => void;
}

/** Coordinates the first-run guided tour: whether it's showing, and whether to auto-launch a beginner session after it. */
export function useIntroTourFlow({ markIntroTourSeen, launchBeginnerSession }: UseIntroTourFlowOptions) {
  const [showIntroTour, setShowIntroTour] = useState(false);
  const [startAfterTour, setStartAfterTour] = useState(false);

  const takeTour = () => {
    setStartAfterTour(true);
    setShowIntroTour(true);
  };

  const quickStart = () => {
    setShowIntroTour(false);
    setStartAfterTour(false);
    launchBeginnerSession();
  };

  const completeTour = () => {
    markIntroTourSeen();
    setShowIntroTour(false);
    if (startAfterTour) {
      setStartAfterTour(false);
      launchBeginnerSession();
    }
  };

  const skipTour = () => {
    markIntroTourSeen();
    setShowIntroTour(false);
    setStartAfterTour(false);
  };

  return { showIntroTour, takeTour, quickStart, completeTour, skipTour };
}
