'use client';

import React from 'react';
import InstallPrompt from '../../components/InstallPrompt';
import CompletionScreen from '../../components/CompletionScreen';
import OfflineIndicator from '../../components/OfflineIndicator';
import ParticleBurst from '../../components/ParticleBurst';
import ProgramSelector from '../../components/ProgramSelector';
import RendererDiagnostics from '../../components/RendererDiagnostics';
import EnvironmentBackground from '../../components/EnvironmentBackground';
import InstructorVideoGuide from '../../components/InstructorVideoGuide';
import TrendsSheet from '../../components/TrendsSheet';
import BreathCanvas from '../session/BreathCanvas';
import StatsHeader from '../session/StatsHeader';
import PhaseDisplay from '../session/PhaseDisplay';
import SessionControls from '../session/SessionControls';
import SettingsDrawer from '../settings/SettingsDrawer';
import PracticeShell from './PracticeShell';
import { usePractice } from './PracticeProvider';
import { useSession } from '../session/SessionProvider';

const CHAKRA_LABELS = ['inhale', 'hold1', 'exhale', 'hold2'];
const BURST_COLORS: Record<string, string> = {
  inhale: '#fa7e1e',
  hold1: '#f4d35e',
  exhale: '#2ecc71',
  hold2: '#5b3cc4',
};

export default function PracticeScreen() {
  const {
    breathPhase,
    isRunning,
    currentPhase,
    settings,
    totalBreaths,
    phaseProgress,
    remaining,
    phaseDuration,
    intensity,
    reset,
    updateSettings,
  } = useSession();
  const {
    practice,
    program,
    completion,
    onboarding,
    history,
    voice,
    environment,
    instructor,
    renderer,
    settings: settingsUi,
  } = usePractice();

  const chakraPhase = CHAKRA_LABELS.indexOf(currentPhase);

  return (
    <main className="min-h-dvh bg-[#05010a] text-white relative overflow-hidden">
      <OfflineIndicator />

      <EnvironmentBackground environmentId={environment.activeId} theme={practice.selectedMode.theme} chakraPhase={chakraPhase} />

      {instructor.canUse && (
        <InstructorVideoGuide
          enabled={instructor.settings.enabled}
          layout={instructor.settings.layout}
          pipSize={instructor.settings.pipSize}
          pipCorner={instructor.settings.pipCorner}
          pipDragOffset={instructor.settings.pipDragOffset}
          audioEnabled={instructor.settings.audioEnabled}
          voiceGuidanceEnabled={voice.settings.enabled}
          figurePose={practice.selectedMode.figurePose}
          isRunning={isRunning}
          currentPhase={currentPhase}
          phaseProgress={phaseProgress}
          phaseDurationSec={phaseDuration}
          intensity={intensity}
          onDragOffset={(pipDragOffset) => instructor.updateSettings({ pipDragOffset })}
        />
      )}

      <BreathCanvas
        breathPhase={breathPhase}
        intensity={intensity}
        chakraPhase={chakraPhase}
        phaseProgress={phaseProgress}
        selectedMode={practice.selectedMode}
        effectivePerformanceMode={renderer.effectivePerformanceMode}
        reducedMotion={renderer.settings.reducedMotion || renderer.isPerformanceForced}
        pauseRendering={completion.showCompletion}
        persistedGovernorTier={renderer.settings.governorTier}
        onGovernorTierChange={(governorTier) => renderer.updateSettings({ governorTier })}
        onDiagnostics={renderer.updateDiagnostics}
      />

      <div
        className="pointer-events-none fixed inset-0 z-[5]"
        style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.42) 100%)' }}
      />

      <ParticleBurst phase={currentPhase} isRunning={isRunning} color={practice.selectedMode.accentColor ?? BURST_COLORS[currentPhase]} />

      <StatsHeader
        todayMinutes={history.stats.todayMinutes}
        todayBreaths={history.stats.todayBreaths}
        currentStreak={history.stats.currentStreak}
        onOpenTrends={history.openTrends}
      />

      <TrendsSheet
        open={history.trendsOpen}
        onClose={history.closeTrends}
        trends={history.trends}
        techniqueTotals={history.techniqueTotals}
        legacyBaseline={history.ledger.legacyBaseline}
      />

      <PhaseDisplay
        currentPhase={currentPhase}
        breathPhase={breathPhase}
        remaining={remaining}
        phaseProgress={phaseProgress}
        totalBreaths={totalBreaths}
        figurePose={practice.selectedMode.figurePose}
        muscleCue={practice.activeMuscleCues[currentPhase]}
      />

      <SessionControls
        isRunning={isRunning}
        lastSession={practice.lastSession}
        onResumeLastSession={practice.startMode}
        activeProgramId={program.activeProgramId}
        programProgress={program.progress}
        onOpenProgramSelector={program.openSelector}
        onStartProgramSession={program.startSession}
        sortedModes={practice.sortedModes}
        selectedMode={practice.selectedMode}
        settings={settings}
        favoriteModeIds={practice.favoriteModeIds}
        onModeSelect={practice.selectMode}
        onModeStart={practice.startMode}
        onNudge={practice.nudgePhase}
        onSetPhaseDuration={practice.setPhaseDuration}
        onToggleFavorite={practice.toggleFavoriteMode}
        onQuickStart={practice.quickStart}
        onBeginPause={practice.beginPause}
        onReset={reset}
        voiceEnabled={voice.settings.enabled}
        useSanskrit={voice.settings.useSanskrit}
        onToggleVoice={voice.toggleVoice}
        onToggleSanskrit={voice.toggleSanskrit}
        canUseInstructor={instructor.canUse}
        instructorEnabled={instructor.settings.enabled}
        onToggleInstructor={instructor.toggleEnabled}
        onOpenSettings={settingsUi.openSettings}
      />

      <PracticeShell
        shouldShowWelcome={onboarding.shouldShowWelcome}
        isRunning={isRunning}
        showIntroTour={onboarding.showIntroTour}
        onQuickStart={onboarding.quickStart}
        onTakeTour={onboarding.takeTour}
        onExplore={onboarding.explore}
        onSkipForever={onboarding.skipForever}
        onTourComplete={onboarding.completeTour}
        onTourSkip={onboarding.skipTour}
      />

      {completion.showCompletion && (
        <CompletionScreen
          minutes={completion.completedInfo.minutes}
          breaths={completion.completedInfo.breaths}
          streak={history.stats.currentStreak}
          isFirstSession={completion.completionMeta?.isFirstSession}
          practicedModeLabel={completion.completionMeta?.modeLabel}
          practicedModeEmoji={completion.completionMeta?.modeEmoji}
          nextStepLabel={completion.nextStepSuggestion.label}
          nextStepReason={completion.completionMeta?.isFirstSession ? completion.nextStepSuggestion.reason : undefined}
          onTryNext={completion.completionMeta?.isFirstSession ? completion.handleTryNextMode : undefined}
          onClose={completion.handleCompletionClose}
          nextProgramSession={completion.nextProgramSession ?? undefined}
        />
      )}

      <ProgramSelector
        programs={program.catalog}
        activeProgramId={program.activeProgramId}
        activeProgress={program.progress}
        open={program.selectorOpen}
        onClose={program.closeSelector}
        onSelect={program.selectProgramAndClose}
        onAbandon={program.abandonProgramAndClose}
        onReset={program.resetProgramAndClose}
      />

      <SettingsDrawer
        open={settingsUi.drawerOpen}
        onClose={settingsUi.closeSettings}
        selectedMode={practice.selectedMode}
        settings={settings}
        updateSettings={updateSettings}
        environmentOverride={environment.override}
        setEnvironmentOverride={environment.setOverride}
        canUseInstructor={instructor.canUse}
        instructorSettings={instructor.settings}
        updateInstructorSettings={instructor.updateSettings}
        rendererSettings={renderer.settings}
        updateRendererSettings={renderer.updateSettings}
        effectivePerformanceMode={renderer.effectivePerformanceMode}
        isPerformanceForced={renderer.isPerformanceForced}
      />

      {renderer.settings.showDiagnostics && <RendererDiagnostics state={renderer.diagnostics} />}

      <InstallPrompt />
    </main>
  );
}
