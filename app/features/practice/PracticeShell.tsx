'use client';

import React from 'react';
import WelcomePanel from '../../components/WelcomePanel';
import PracticeIntroTour from '../../components/PracticeIntroTour';

interface PracticeShellProps {
  shouldShowWelcome: boolean;
  isRunning: boolean;
  showIntroTour: boolean;
  onQuickStart: () => void;
  onTakeTour: () => void;
  onExplore: () => void;
  onSkipForever: () => void;
  onTourComplete: () => void;
  onTourSkip: () => void;
}

/** Composes the first-run welcome panel and guided intro tour overlays. */
export default function PracticeShell({
  shouldShowWelcome,
  isRunning,
  showIntroTour,
  onQuickStart,
  onTakeTour,
  onExplore,
  onSkipForever,
  onTourComplete,
  onTourSkip,
}: PracticeShellProps) {
  return (
    <>
      {shouldShowWelcome && !isRunning && !showIntroTour && (
        <WelcomePanel
          onQuickStart={onQuickStart}
          onTakeTour={onTakeTour}
          onExplore={onExplore}
          onSkipForever={onSkipForever}
        />
      )}

      {showIntroTour && (
        <PracticeIntroTour onComplete={onTourComplete} onSkip={onTourSkip} />
      )}
    </>
  );
}
