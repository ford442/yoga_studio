'use client';

import React, { useEffect, useRef, useState } from 'react';
import InstallPrompt from './components/InstallPrompt';
import CompletionScreen from './components/CompletionScreen';
import OfflineIndicator from './components/OfflineIndicator';
import ParticleBurst from './components/ParticleBurst';
import ProgramSelector from './components/ProgramSelector';
import { useBreathAudio } from './hooks/useBreathAudio';
import { useSessionStats } from './hooks/useSessionStats';
import { useVoiceGuidance } from './hooks/useVoiceGuidance';
import { useOnboarding } from './hooks/useOnboarding';
import { useRendererSettings } from './hooks/useRendererSettings';
import { PROGRAMS } from './data/programs';
import { useActiveProgram } from './hooks/useActiveProgram';
import { useLastSession } from './hooks/useLastSession';
import { usePracticeSession } from './hooks/usePracticeSession';
import { useSessionCompletion } from './hooks/useSessionCompletion';
import { useIntroTourFlow } from './hooks/useIntroTourFlow';
import RendererDiagnostics from './components/RendererDiagnostics';
import { type RendererDiagnosticsState } from './types/renderer';
import { BEGINNER_MUSCLE_CUES } from './data/onboarding';
import EnvironmentBackground from './components/EnvironmentBackground';
import InstructorVideoGuide from './components/InstructorVideoGuide';
import { useEnvironment } from './hooks/useEnvironment';
import { useInstructorVideo } from './hooks/useInstructorVideo';
import { SessionProvider, useSession } from './features/session/SessionProvider';
import BreathCanvas from './features/session/BreathCanvas';
import StatsHeader from './features/session/StatsHeader';
import PhaseDisplay from './features/session/PhaseDisplay';
import SessionControls from './features/session/SessionControls';
import SettingsDrawer from './features/settings/SettingsDrawer';
import PracticeShell from './features/practice/PracticeShell';

const CHAKRA_LABELS = ['inhale', 'hold1', 'exhale', 'hold2'];
const BURST_COLORS: Record<string, string> = {
  inhale: '#fa7e1e',
  hold1: '#f4d35e',
  exhale: '#2ecc71',
  hold2: '#5b3cc4',
};

export default function Home() {
  return (
    <SessionProvider>
      <PracticeScreen />
    </SessionProvider>
  );
}

function PracticeScreen() {
  const {
    breathPhase, isRunning, currentPhase, settings, sessionDuration, totalBreaths,
    totalCycle, phaseProgress, remaining, phaseDuration, intensity,
    startSession, toggleFree, reset, updateSettings,
  } = useSession();

  const { stats, addPracticeTime } = useSessionStats();
  const { settings: voiceSettings, toggleVoice, toggleSanskrit, setVoiceEnabled } = useVoiceGuidance(currentPhase, isRunning);
  const onboarding = useOnboarding();
  const { activeProgramId, progress: programProgress, selectProgram, completeDay, abandonProgram, resetProgram } = useActiveProgram();
  const { lastSession, persistLastSession } = useLastSession();
  const {
    settings: rendererSettings, updateSettings: updateRendererSettings,
    effectivePerformanceMode, isPerformanceForced,
  } = useRendererSettings();
  const { settings: instructorSettings, canUseInstructor, updateSettings: updateInstructorSettings, toggleEnabled: toggleInstructorEnabled } = useInstructorVideo();

  const {
    selectedMode, sortedModes, favoriteModeIds, isBeginnerSession, setIsBeginnerSession,
    activeProgramSession, setActiveProgramSession,
    handleModeSelect, handleModeStart, handleStartProgramSession, handleQuickStart, handleBeginPause,
    launchBeginnerSession, handleNudge, handleSetPhaseDuration, toggleFavoriteMode,
  } = usePracticeSession({
    settings, isRunning, startSession, toggleFree, updateSettings, persistLastSession,
    setVoiceEnabled, canUseInstructor,
    enableInstructor: () => updateInstructorSettings({ enabled: true }),
    dismissWelcome: onboarding.dismissWelcome,
  });

  const { override: environmentOverride, activeId: activeEnvironmentId, setOverride: setEnvironmentOverride } = useEnvironment(selectedMode.backgroundId);

  const {
    showCompletion, completedInfo, completionMeta, nextProgramSession, nextStepSuggestion,
    handleCompletionClose, handleTryNextMode,
  } = useSessionCompletion({
    isRunning, sessionDuration, totalBreaths, selectedMode,
    activeProgramSession,
    clearActiveProgramSession: () => setActiveProgramSession(null),
    clearBeginnerSession: () => setIsBeginnerSession(false),
    programProgress, completeDay,
    onboardingHasLoaded: onboarding.hasLoaded,
    hasCompletedFirstSession: onboarding.hasCompletedFirstSession,
    markFirstSessionComplete: onboarding.markFirstSessionComplete,
    startMode: handleModeStart,
  });

  const { showIntroTour, takeTour, quickStart, completeTour, skipTour } = useIntroTourFlow({
    markIntroTourSeen: onboarding.markIntroTourSeen,
    launchBeginnerSession,
  });

  const [showDrawer, setShowDrawer] = useState(false);
  const [showProgramSelector, setShowProgramSelector] = useState(false);
  const [rendererDiagnostics, setRendererDiagnostics] = useState<RendererDiagnosticsState | null>(null);
  const prevPhaseRef = useRef(currentPhase);

  useBreathAudio({ currentPhase, phaseProgress, isRunning, themeIndex: selectedMode.theme });

  // Detect full breath cycle completion (hold2 → inhale transition).
  useEffect(() => {
    if (prevPhaseRef.current === 'hold2' && currentPhase === 'inhale') {
      addPracticeTime(totalCycle);
    }
    prevPhaseRef.current = currentPhase;
  }, [currentPhase, totalCycle, addPracticeTime]);

  const hasEnvironment = activeEnvironmentId !== 'none';
  const chakraPhase = CHAKRA_LABELS.indexOf(currentPhase);
  const activeMuscleCues = isBeginnerSession ? BEGINNER_MUSCLE_CUES : selectedMode.technique.phaseCues;

  return (
    <main className="min-h-dvh bg-[#05010a] text-white relative overflow-hidden">
      <OfflineIndicator />

      <EnvironmentBackground environmentId={activeEnvironmentId} theme={selectedMode.theme} chakraPhase={chakraPhase} />

      {canUseInstructor && (
        <InstructorVideoGuide
          enabled={instructorSettings.enabled}
          layout={instructorSettings.layout}
          pipSize={instructorSettings.pipSize}
          pipCorner={instructorSettings.pipCorner}
          pipDragOffset={instructorSettings.pipDragOffset}
          audioEnabled={instructorSettings.audioEnabled}
          voiceGuidanceEnabled={voiceSettings.enabled}
          figurePose={selectedMode.figurePose}
          isRunning={isRunning}
          currentPhase={currentPhase}
          phaseProgress={phaseProgress}
          phaseDurationSec={phaseDuration}
          intensity={intensity}
          onDragOffset={(pipDragOffset) => updateInstructorSettings({ pipDragOffset })}
        />
      )}

      <BreathCanvas
        breathPhase={breathPhase}
        intensity={intensity}
        chakraPhase={chakraPhase}
        phaseProgress={phaseProgress}
        selectedMode={selectedMode}
        hasEnvironment={hasEnvironment}
        effectivePerformanceMode={effectivePerformanceMode}
        reducedMotion={rendererSettings.reducedMotion || isPerformanceForced}
        pauseRendering={showCompletion}
        persistedGovernorTier={rendererSettings.governorTier}
        onGovernorTierChange={(governorTier) => updateRendererSettings({ governorTier })}
        onDiagnostics={setRendererDiagnostics}
      />

      <div
        className="pointer-events-none fixed inset-0 z-[5]"
        style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.42) 100%)' }}
      />

      <ParticleBurst phase={currentPhase} isRunning={isRunning} color={selectedMode.accentColor ?? BURST_COLORS[currentPhase]} />

      <StatsHeader todayMinutes={stats.todayMinutes} todayBreaths={stats.todayBreaths} currentStreak={stats.currentStreak} />

      <PhaseDisplay
        currentPhase={currentPhase}
        breathPhase={breathPhase}
        remaining={remaining}
        phaseProgress={phaseProgress}
        totalBreaths={totalBreaths}
        figurePose={selectedMode.figurePose}
        muscleCue={activeMuscleCues[currentPhase]}
      />

      <SessionControls
        isRunning={isRunning}
        lastSession={lastSession}
        onResumeLastSession={handleModeStart}
        activeProgramId={activeProgramId}
        programProgress={programProgress}
        onOpenProgramSelector={() => setShowProgramSelector(true)}
        onStartProgramSession={handleStartProgramSession}
        sortedModes={sortedModes}
        selectedMode={selectedMode}
        settings={settings}
        favoriteModeIds={favoriteModeIds}
        onModeSelect={handleModeSelect}
        onModeStart={handleModeStart}
        onNudge={handleNudge}
        onSetPhaseDuration={handleSetPhaseDuration}
        onToggleFavorite={toggleFavoriteMode}
        onQuickStart={handleQuickStart}
        onBeginPause={handleBeginPause}
        onReset={reset}
        voiceEnabled={voiceSettings.enabled}
        useSanskrit={voiceSettings.useSanskrit}
        onToggleVoice={toggleVoice}
        onToggleSanskrit={toggleSanskrit}
        canUseInstructor={canUseInstructor}
        instructorEnabled={instructorSettings.enabled}
        onToggleInstructor={toggleInstructorEnabled}
        onOpenSettings={() => setShowDrawer(true)}
      />

      <PracticeShell
        shouldShowWelcome={onboarding.shouldShowWelcome}
        isRunning={isRunning}
        showIntroTour={showIntroTour}
        onQuickStart={quickStart}
        onTakeTour={takeTour}
        onExplore={() => onboarding.dismissWelcome(false)}
        onSkipForever={() => onboarding.dismissWelcome(true)}
        onTourComplete={completeTour}
        onTourSkip={skipTour}
      />

      {showCompletion && (
        <CompletionScreen
          minutes={completedInfo.minutes}
          breaths={completedInfo.breaths}
          streak={stats.currentStreak}
          isFirstSession={completionMeta?.isFirstSession}
          practicedModeLabel={completionMeta?.modeLabel}
          practicedModeEmoji={completionMeta?.modeEmoji}
          nextStepLabel={nextStepSuggestion.label}
          nextStepReason={completionMeta?.isFirstSession ? nextStepSuggestion.reason : undefined}
          onTryNext={completionMeta?.isFirstSession ? handleTryNextMode : undefined}
          onClose={handleCompletionClose}
          nextProgramSession={nextProgramSession ?? undefined}
        />
      )}

      <ProgramSelector
        programs={PROGRAMS}
        activeProgramId={activeProgramId}
        activeProgress={programProgress}
        open={showProgramSelector}
        onClose={() => setShowProgramSelector(false)}
        onSelect={(programId) => { selectProgram(programId); setShowProgramSelector(false); }}
        onAbandon={() => { abandonProgram(); setShowProgramSelector(false); }}
        onReset={() => { resetProgram(); setShowProgramSelector(false); }}
      />

      <SettingsDrawer
        open={showDrawer}
        onClose={() => setShowDrawer(false)}
        selectedMode={selectedMode}
        settings={settings}
        updateSettings={updateSettings}
        environmentOverride={environmentOverride}
        setEnvironmentOverride={setEnvironmentOverride}
        canUseInstructor={canUseInstructor}
        instructorSettings={instructorSettings}
        updateInstructorSettings={updateInstructorSettings}
        rendererSettings={rendererSettings}
        updateRendererSettings={updateRendererSettings}
        effectivePerformanceMode={effectivePerformanceMode}
        isPerformanceForced={isPerformanceForced}
      />

      {rendererSettings.showDiagnostics && <RendererDiagnostics state={rendererDiagnostics} />}

      {/* Global PWA install prompt (listens for beforeinstallprompt) */}
      <InstallPrompt />
    </main>
  );
}
