'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useSession } from '../session/SessionProvider';
import { useBreathAudio } from '../../hooks/useBreathAudio';
import { useSessionStats } from '../../hooks/useSessionStats';
import { useVoiceGuidance } from '../../hooks/useVoiceGuidance';
import { useOnboarding } from '../../hooks/useOnboarding';
import { useRendererSettings } from '../../hooks/useRendererSettings';
import { useActiveProgram } from '../../hooks/useActiveProgram';
import { useLastSession } from '../../hooks/useLastSession';
import { usePracticeSession } from '../../hooks/usePracticeSession';
import { useSessionCompletion } from '../../hooks/useSessionCompletion';
import { useIntroTourFlow } from '../../hooks/useIntroTourFlow';
import { useEnvironment } from '../../hooks/useEnvironment';
import { useInstructorVideo } from '../../hooks/useInstructorVideo';
import { useSessionRecorder } from '../../hooks/useSessionRecorder';
import { PROGRAMS } from '../../data/programs';
import { BEGINNER_MUSCLE_CUES } from '../../data/onboarding';
import type { BreathPhase, BreathSettings } from '../../hooks/useBreathTimer';
import type { QuickStartDuration, LastSession } from '../../hooks/useLastSession';
import type { SessionMode } from '../../types/sessionMode';
import type { Program, ActiveProgramProgress } from '../../types/program';
import type { EnvironmentOverride } from '../../types/environment';
import type { InstructorVideoSettings } from '../../types/instructorVideo';
import type { RendererDiagnosticsState, RendererSettings } from '../../types/renderer';

type SessionStatsState = ReturnType<typeof useSessionStats>;
type VoiceState = ReturnType<typeof useVoiceGuidance>;
type CompletionState = ReturnType<typeof useSessionCompletion>;

export interface PracticeContextValue {
  practice: {
    selectedMode: SessionMode;
    sortedModes: SessionMode[];
    favoriteModeIds: string[];
    lastSession: LastSession | null;
    activeMuscleCues: Record<BreathPhase, string>;
    selectMode: (mode: SessionMode) => void;
    startMode: (mode: SessionMode, duration: QuickStartDuration) => void;
    quickStart: (duration: 5 | 10 | 15) => void;
    beginPause: () => void;
    nudgePhase: (key: keyof BreathSettings, delta: number) => void;
    setPhaseDuration: (key: keyof BreathSettings, value: number) => void;
    toggleFavoriteMode: (modeId: string) => void;
  };
  program: {
    catalog: Program[];
    activeProgramId: string | null;
    progress: ActiveProgramProgress | null;
    selectorOpen: boolean;
    openSelector: () => void;
    closeSelector: () => void;
    startSession: (programId: string, dayIndex: number) => void;
    selectProgramAndClose: (programId: string) => void;
    abandonProgramAndClose: () => void;
    resetProgramAndClose: () => void;
  };
  completion: CompletionState;
  onboarding: {
    shouldShowWelcome: boolean;
    showIntroTour: boolean;
    quickStart: () => void;
    takeTour: () => void;
    explore: () => void;
    skipForever: () => void;
    completeTour: () => void;
    skipTour: () => void;
  };
  history: Pick<
    SessionStatsState,
    'stats' | 'ledger' | 'trends' | 'techniqueTotals' | 'exportLedgerJson' | 'importLedgerJson'
  > & {
    trendsOpen: boolean;
    openTrends: () => void;
    closeTrends: () => void;
  };
  voice: Pick<VoiceState, 'settings' | 'toggleVoice' | 'toggleSanskrit'>;
  environment: {
    override: EnvironmentOverride;
    activeId: ReturnType<typeof useEnvironment>['activeId'];
    setOverride: (next: EnvironmentOverride) => void;
  };
  instructor: {
    settings: InstructorVideoSettings;
    canUse: boolean;
    updateSettings: (patch: Partial<InstructorVideoSettings>) => void;
    toggleEnabled: () => void;
  };
  renderer: {
    settings: RendererSettings;
    effectivePerformanceMode: ReturnType<typeof useRendererSettings>['effectivePerformanceMode'];
    isPerformanceForced: boolean;
    diagnostics: RendererDiagnosticsState | null;
    updateSettings: (patch: Partial<RendererSettings>) => void;
    updateDiagnostics: (state: RendererDiagnosticsState) => void;
  };
  settings: {
    drawerOpen: boolean;
    openSettings: () => void;
    closeSettings: () => void;
  };
}

const PracticeContext = createContext<PracticeContextValue | null>(null);

export function PracticeProvider({ children }: { children: React.ReactNode }) {
  const {
    isRunning,
    currentPhase,
    settings,
    completedSegment,
    activeSegmentId,
    phaseProgress,
    startSession,
    toggleFree,
    updateSettings,
  } = useSession();
  const sessionStats = useSessionStats();
  const voiceGuidance = useVoiceGuidance(currentPhase, isRunning);
  const onboardingState = useOnboarding();
  const {
    activeProgramId,
    progress: programProgress,
    selectProgram,
    completeDay,
    abandonProgram,
    resetProgram,
  } = useActiveProgram();
  const { lastSession, persistLastSession } = useLastSession();
  const rendererSettingsState = useRendererSettings();
  const instructorVideo = useInstructorVideo();

  const practiceSession = usePracticeSession({
    settings,
    isRunning,
    startSession,
    toggleFree,
    updateSettings,
    persistLastSession,
    setVoiceEnabled: voiceGuidance.setVoiceEnabled,
    canUseInstructor: instructorVideo.canUseInstructor,
    enableInstructor: () => instructorVideo.updateSettings({ enabled: true }),
    dismissWelcome: onboardingState.dismissWelcome,
  });
  const environmentState = useEnvironment(practiceSession.selectedMode.backgroundId);

  const completionState = useSessionCompletion({
    completedSegment,
    selectedMode: practiceSession.selectedMode,
    activeProgramSession: practiceSession.activeProgramSession,
    clearActiveProgramSession: () => practiceSession.setActiveProgramSession(null),
    clearBeginnerSession: () => practiceSession.setIsBeginnerSession(false),
    programProgress,
    completeDay,
    onboardingHasLoaded: onboardingState.hasLoaded,
    hasCompletedFirstSession: onboardingState.hasCompletedFirstSession,
    markFirstSessionComplete: onboardingState.markFirstSessionComplete,
    startMode: practiceSession.handleModeStart,
  });

  const introTour = useIntroTourFlow({
    markIntroTourSeen: onboardingState.markIntroTourSeen,
    launchBeginnerSession: practiceSession.launchBeginnerSession,
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [trendsOpen, setTrendsOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [diagnostics, setDiagnostics] = useState<RendererDiagnosticsState | null>(null);

  useBreathAudio({
    currentPhase,
    phaseProgress,
    isRunning,
    themeIndex: practiceSession.selectedMode.theme,
  });

  useSessionRecorder({
    activeSegmentId,
    isRunning,
    completedSegment,
    modeId: practiceSession.selectedMode.id,
    programId: practiceSession.activeProgramSession?.programId,
    settings,
    recordSession: sessionStats.recordSession,
  });

  const openSettings = useCallback(() => setDrawerOpen(true), []);
  const closeSettings = useCallback(() => setDrawerOpen(false), []);
  const openTrends = useCallback(() => setTrendsOpen(true), []);
  const closeTrends = useCallback(() => setTrendsOpen(false), []);
  const openSelector = useCallback(() => setSelectorOpen(true), []);
  const closeSelector = useCallback(() => setSelectorOpen(false), []);
  const updateDiagnostics = useCallback((state: RendererDiagnosticsState) => setDiagnostics(state), []);
  const selectProgramAndClose = useCallback((programId: string) => {
    selectProgram(programId);
    setSelectorOpen(false);
  }, [selectProgram]);
  const abandonProgramAndClose = useCallback(() => {
    abandonProgram();
    setSelectorOpen(false);
  }, [abandonProgram]);
  const resetProgramAndClose = useCallback(() => {
    resetProgram();
    setSelectorOpen(false);
  }, [resetProgram]);
  const { dismissWelcome } = onboardingState;
  const explore = useCallback(() => dismissWelcome(false), [dismissWelcome]);
  const skipForever = useCallback(() => dismissWelcome(true), [dismissWelcome]);

  const activeMuscleCues = practiceSession.isBeginnerSession
    ? BEGINNER_MUSCLE_CUES
    : practiceSession.selectedMode.technique.phaseCues;

  const value = useMemo<PracticeContextValue>(() => ({
    practice: {
      selectedMode: practiceSession.selectedMode,
      sortedModes: practiceSession.sortedModes,
      favoriteModeIds: practiceSession.favoriteModeIds,
      lastSession,
      activeMuscleCues,
      selectMode: practiceSession.handleModeSelect,
      startMode: practiceSession.handleModeStart,
      quickStart: practiceSession.handleQuickStart,
      beginPause: practiceSession.handleBeginPause,
      nudgePhase: practiceSession.handleNudge,
      setPhaseDuration: practiceSession.handleSetPhaseDuration,
      toggleFavoriteMode: practiceSession.toggleFavoriteMode,
    },
    program: {
      catalog: PROGRAMS,
      activeProgramId,
      progress: programProgress,
      selectorOpen,
      openSelector,
      closeSelector,
      startSession: practiceSession.handleStartProgramSession,
      selectProgramAndClose,
      abandonProgramAndClose,
      resetProgramAndClose,
    },
    completion: completionState,
    onboarding: {
      shouldShowWelcome: onboardingState.shouldShowWelcome,
      showIntroTour: introTour.showIntroTour,
      quickStart: introTour.quickStart,
      takeTour: introTour.takeTour,
      explore,
      skipForever,
      completeTour: introTour.completeTour,
      skipTour: introTour.skipTour,
    },
    history: {
      stats: sessionStats.stats,
      ledger: sessionStats.ledger,
      trends: sessionStats.trends,
      techniqueTotals: sessionStats.techniqueTotals,
      exportLedgerJson: sessionStats.exportLedgerJson,
      importLedgerJson: sessionStats.importLedgerJson,
      trendsOpen,
      openTrends,
      closeTrends,
    },
    voice: {
      settings: voiceGuidance.settings,
      toggleVoice: voiceGuidance.toggleVoice,
      toggleSanskrit: voiceGuidance.toggleSanskrit,
    },
    environment: {
      override: environmentState.override,
      activeId: environmentState.activeId,
      setOverride: environmentState.setOverride,
    },
    instructor: {
      settings: instructorVideo.settings,
      canUse: instructorVideo.canUseInstructor,
      updateSettings: instructorVideo.updateSettings,
      toggleEnabled: instructorVideo.toggleEnabled,
    },
    renderer: {
      settings: rendererSettingsState.settings,
      effectivePerformanceMode: rendererSettingsState.effectivePerformanceMode,
      isPerformanceForced: rendererSettingsState.isPerformanceForced,
      diagnostics,
      updateSettings: rendererSettingsState.updateSettings,
      updateDiagnostics,
    },
    settings: { drawerOpen, openSettings, closeSettings },
  }), [
    practiceSession,
    lastSession,
    activeMuscleCues,
    activeProgramId,
    programProgress,
    selectorOpen,
    openSelector,
    closeSelector,
    selectProgramAndClose,
    abandonProgramAndClose,
    resetProgramAndClose,
    completionState,
    onboardingState.shouldShowWelcome,
    introTour,
    explore,
    skipForever,
    sessionStats,
    trendsOpen,
    openTrends,
    closeTrends,
    voiceGuidance,
    environmentState,
    instructorVideo,
    rendererSettingsState,
    diagnostics,
    updateDiagnostics,
    drawerOpen,
    openSettings,
    closeSettings,
  ]);

  return <PracticeContext.Provider value={value}>{children}</PracticeContext.Provider>;
}

export function usePractice(): PracticeContextValue {
  const context = useContext(PracticeContext);
  if (!context) throw new Error('usePractice must be used within a PracticeProvider');
  return context;
}
