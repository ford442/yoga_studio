'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import WebGPUShader from './components/WebGPUShader';
import InstallPrompt from './components/InstallPrompt';
import ExportStats from './components/ExportStats';
import CompletionScreen from './components/CompletionScreen';
import OfflineIndicator from './components/OfflineIndicator';
import ProgramNextSessionCard from './components/ProgramNextSessionCard';
import ProgramSelector from './components/ProgramSelector';
import SessionModeSwitcher from './components/SessionModeSwitcher';
import ParticleBurst from './components/ParticleBurst';
import WelcomePanel from './components/WelcomePanel';
import PracticeIntroTour from './components/PracticeIntroTour';
import { useBreathTimer, type SessionDuration } from './hooks/useBreathTimer';
import { useBreathAudio } from './hooks/useBreathAudio';
import { useSessionStats } from './hooks/useSessionStats';
import { useVoiceGuidance } from './hooks/useVoiceGuidance';
import { useRippleAudio } from './hooks/useRippleAudio';
import { useOnboarding } from './hooks/useOnboarding';
import { useRendererSettings } from './hooks/useRendererSettings';
import { SESSION_MODES, DEFAULT_MODE } from './data/sessionModes';
import { PROGRAMS, getProgramById, getNextSessionDay, resolveProgramSessionTechnique } from './data/programs';
import { useActiveProgram } from './hooks/useActiveProgram';
import RendererDiagnostics from './components/RendererDiagnostics';
import { type RendererDiagnosticsState } from './types/renderer';
import {
  BEGINNER_MUSCLE_CUES,
  BEGINNER_SESSION_MINUTES,
  DEFAULT_NEXT_STEP,
  NEXT_STEP_BY_MODE,
  getBeginnerMode,
} from './data/onboarding';
import type { SessionMode } from './types/sessionMode';
import BreathingAvatar from './components/BreathingAvatar';
import EnvironmentBackground from './components/EnvironmentBackground';
import InstructorVideoGuide from './components/InstructorVideoGuide';
import { useEnvironment } from './hooks/useEnvironment';
import { useInstructorVideo } from './hooks/useInstructorVideo';
import { ENVIRONMENTS } from './data/environments';

const chakraLabels = ['inhale', 'hold1', 'exhale', 'hold2'];
type QuickStartDuration = 'free' | 5 | 10 | 15;
type LastSession = { modeId: string; duration: QuickStartDuration };
type CompletionMeta = {
  isFirstSession: boolean;
  modeId: string;
  modeLabel: string;
  modeEmoji: string;
};

type ActiveProgramSession = {
  programId: string;
  dayIndex: number;
};

export default function Home() {
  const {
    breathPhase,
    isRunning,
    currentPhase,
    settings,
    sessionDuration,
    totalBreaths,
    startSession,
    toggleFree,
    reset,
    updateSettings,
  } = useBreathTimer();

  const totalCycle = settings.inhale + settings.hold1 + settings.exhale + settings.hold2;

  const { phaseProgress: earlyPhaseProgress, remaining, phaseDuration } = useMemo(() => {
    const elapsedInCycle = (breathPhase * totalCycle) % totalCycle;
    let remaining = 0;
    if (currentPhase === 'inhale') remaining = settings.inhale - elapsedInCycle;
    else if (currentPhase === 'hold1') remaining = settings.hold1 - (elapsedInCycle - settings.inhale);
    else if (currentPhase === 'exhale') remaining = settings.exhale - (elapsedInCycle - settings.inhale - settings.hold1);
    else remaining = settings.hold2 - (elapsedInCycle - settings.inhale - settings.hold1 - settings.exhale);

    const phaseDuration =
      currentPhase === 'inhale' ? settings.inhale :
      currentPhase === 'hold1' ? settings.hold1 :
      currentPhase === 'exhale' ? settings.exhale :
      settings.hold2;
    const phaseElapsed = phaseDuration > 0
      ? Math.max(0, phaseDuration - Math.max(0, remaining))
      : 0;
    const phaseProgress = phaseDuration > 0
      ? Math.min(1, phaseElapsed / phaseDuration)
      : 0;

    return { phaseProgress, remaining, phaseDuration };
  }, [breathPhase, totalCycle, currentPhase, settings]);

  const { stats, addPracticeTime } = useSessionStats();
  const {
    settings: voiceSettings,
    toggleVoice,
    toggleSanskrit,
    setVoiceEnabled,
  } = useVoiceGuidance(currentPhase, isRunning);
  const onboarding = useOnboarding();
  const {
    activeProgramId,
    progress: programProgress,
    selectProgram,
    completeDay,
    abandonProgram,
    resetProgram,
  } = useActiveProgram();

  const [showDrawer, setShowDrawer] = useState(false);
  const [showProgramSelector, setShowProgramSelector] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [completedInfo, setCompletedInfo] = useState({ minutes: 5, breaths: 0 });
  const [completionMeta, setCompletionMeta] = useState<CompletionMeta | null>(null);
  const [nextProgramSession, setNextProgramSession] = useState<NonNullable<
    React.ComponentProps<typeof CompletionScreen>['nextProgramSession']
  > | null>(null);
  const [activeProgramSession, setActiveProgramSession] = useState<ActiveProgramSession | null>(null);
  const [showIntroTour, setShowIntroTour] = useState(false);
  const [startAfterTour, setStartAfterTour] = useState(false);
  const [isBeginnerSession, setIsBeginnerSession] = useState(false);
  const [selectedMode, setSelectedMode] = useState<SessionMode>(DEFAULT_MODE);
  const [favoriteModeIds, setFavoriteModeIds] = useState<string[]>([]);
  const [lastSession, setLastSession] = useState<LastSession | null>(null);
  const [mouse, setMouse] = useState({ x: -2, y: -2 });
  const [mouseStrength, setMouseStrength] = useState(0);
  const { playRipple } = useRippleAudio();
  useBreathAudio({
    currentPhase,
    phaseProgress: earlyPhaseProgress,
    isRunning,
    themeIndex: selectedMode.theme,
  });
  const {
    settings: rendererSettings,
    updateSettings: updateRendererSettings,
    effectivePerformanceMode,
    isPerformanceForced,
  } = useRendererSettings();
  const [rendererDiagnostics, setRendererDiagnostics] = useState<RendererDiagnosticsState | null>(null);
  const { override: environmentOverride, activeId: activeEnvironmentId, setOverride: setEnvironmentOverride } =
    useEnvironment(selectedMode.backgroundId);
  const {
    settings: instructorSettings,
    canUseInstructor,
    updateSettings: updateInstructorSettings,
    toggleEnabled: toggleInstructorEnabled,
  } = useInstructorVideo();
  const hasEnvironment = activeEnvironmentId !== 'none';
  const lastRippleRef = useRef(0);
  const prevSessionDurationRef = useRef<SessionDuration>(null);

  const sortedModes = useMemo(() => {
    if (!favoriteModeIds.length) return SESSION_MODES;
    const favoriteSet = new Set(favoriteModeIds);
    return [...SESSION_MODES].sort((a, b) => {
      const aFav = favoriteSet.has(a.id) ? 1 : 0;
      const bFav = favoriteSet.has(b.id) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      return SESSION_MODES.findIndex((mode) => mode.id === a.id) - SESSION_MODES.findIndex((mode) => mode.id === b.id);
    });
  }, [favoriteModeIds]);

  const persistLastSession = (modeId: string, duration: QuickStartDuration) => {
    const next = { modeId, duration };
    setLastSession(next);
    localStorage.setItem('sacred-breath-last-session', JSON.stringify(next));
  };

  const handleModeSelect = (mode: SessionMode) => {
    setSelectedMode(mode);
    updateSettings(mode.breath);
  };

  const handleModeStart = (mode: SessionMode, duration: QuickStartDuration) => {
    setSelectedMode(mode);
    updateSettings(mode.breath);
    persistLastSession(mode.id, duration);
    setActiveProgramSession(null);
    if (duration === 'free') {
      if (!isRunning) toggleFree();
      return;
    }
    startSession(duration);
  };

  const handleStartProgramSession = (programId: string, dayIndex: number) => {
    const program = getProgramById(programId);
    if (!program) return;
    const day = program.days[dayIndex];
    if (!day || day.type !== 'session') return;

    const technique = resolveProgramSessionTechnique(day, SESSION_MODES);
    setActiveProgramSession({ programId, dayIndex });
    setSelectedMode(technique);
    updateSettings(technique.breath);
    persistLastSession(technique.id, day.durationMinutes);
    if (day.durationMinutes === 'free') {
      if (!isRunning) toggleFree();
      return;
    }
    startSession(day.durationMinutes);
  };

  const handleQuickStart = (duration: 5 | 10 | 15) => {
    persistLastSession(selectedMode.id, duration);
    setActiveProgramSession(null);
    startSession(duration);
  };

  const handleBeginPause = () => {
    if (!isRunning) {
      persistLastSession(selectedMode.id, 'free');
    }
    setActiveProgramSession(null);
    toggleFree();
  };

  const launchBeginnerSession = () => {
    const mode = getBeginnerMode();
    setIsBeginnerSession(true);
    setSelectedMode(mode);
    updateSettings(mode.breath);
    setVoiceEnabled(true);
    if (canUseInstructor) {
      updateInstructorSettings({ enabled: true });
    }
    persistLastSession(mode.id, BEGINNER_SESSION_MINUTES);
    setActiveProgramSession(null);
    onboarding.dismissWelcome(false);
    startSession(BEGINNER_SESSION_MINUTES);
  };

  const handleBeginnerQuickStart = () => {
    setShowIntroTour(false);
    setStartAfterTour(false);
    launchBeginnerSession();
  };

  const handleIntroTourComplete = () => {
    onboarding.markIntroTourSeen();
    setShowIntroTour(false);
    if (startAfterTour) {
      setStartAfterTour(false);
      launchBeginnerSession();
    }
  };

  const handleIntroTourSkip = () => {
    onboarding.markIntroTourSeen();
    setShowIntroTour(false);
    setStartAfterTour(false);
  };

  const handleCompletionClose = () => {
    if (completionMeta?.isFirstSession) {
      onboarding.markFirstSessionComplete();
    }
    setShowCompletion(false);
    setCompletionMeta(null);
    setNextProgramSession(null);
  };

  const handleTryNextMode = () => {
    const next = NEXT_STEP_BY_MODE[completionMeta?.modeId ?? ''] ?? DEFAULT_NEXT_STEP;
    const mode = SESSION_MODES.find((entry) => entry.id === next.modeId);
    if (!mode) {
      handleCompletionClose();
      return;
    }
    setShowCompletion(false);
    setCompletionMeta(null);
    setNextProgramSession(null);
    if (completionMeta?.isFirstSession) {
      onboarding.markFirstSessionComplete();
    }
    handleModeStart(mode, 5);
  };

  const handleNudge = (key: keyof typeof settings, delta: number) => {
    const min = key === 'inhale' || key === 'exhale' ? 1 : 0;
    const max = key === 'hold2' ? 10 : 15;
    const next = Math.max(min, Math.min(max, settings[key] + delta));
    updateSettings({ [key]: next });
  };

  const handleSetPhaseDuration = (key: keyof typeof settings, value: number) => {
    const min = key === 'inhale' || key === 'exhale' ? 1 : 0;
    const max = key === 'hold2' ? 10 : 15;
    const next = Math.max(min, Math.min(max, Number.isFinite(value) ? value : settings[key]));
    updateSettings({ [key]: next });
  };

  const toggleFavoriteMode = (modeId: string) => {
    setFavoriteModeIds((prev) => {
      const next = prev.includes(modeId)
        ? prev.filter((id) => id !== modeId)
        : [...prev, modeId];
      localStorage.setItem('sacred-breath-favorites', JSON.stringify(next));
      return next;
    });
  };

  // Detect full breath cycle completion (hold2 → inhale transition)
  const prevPhaseRef = useRef(currentPhase);
  useEffect(() => {
    if (prevPhaseRef.current === 'hold2' && currentPhase === 'inhale') {
      addPracticeTime(totalCycle);
    }
    prevPhaseRef.current = currentPhase;
  }, [currentPhase, totalCycle, addPracticeTime]);

  // Show completion screen when a timed session ends (use prev ref because
  // endSession() inside the hook nulls sessionDuration on the same update).
  useEffect(() => {
    if (prevSessionDurationRef.current !== null && !isRunning && totalBreaths > 0) {
      const isFirstSession = onboarding.hasLoaded && !onboarding.hasCompletedFirstSession;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCompletedInfo({
        minutes: prevSessionDurationRef.current || 5,
        breaths: totalBreaths,
      });
      setCompletionMeta({
        isFirstSession,
        modeId: selectedMode.id,
        modeLabel: selectedMode.label,
        modeEmoji: selectedMode.emoji,
      });

      // Mark active program day complete and compute the next scheduled session.
      if (activeProgramSession) {
        const { programId, dayIndex } = activeProgramSession;
        completeDay(dayIndex);
        const program = getProgramById(programId);
        if (program) {
          const updatedProgress = {
            ...(programProgress ?? { programId, startDate: new Date().toISOString().split('T')[0], completedDays: [] }),
            completedDays: [...(programProgress?.completedDays ?? []), dayIndex],
          };
          const nextDay = getNextSessionDay(program, updatedProgress);
          if (nextDay) {
            const nextTechnique = resolveProgramSessionTechnique(nextDay, SESSION_MODES);
            setNextProgramSession({
              programLabel: program.label,
              dayIndex: nextDay.dayIndex,
              techniqueLabel: nextTechnique.label,
              techniqueEmoji: nextTechnique.emoji,
              duration: nextDay.durationMinutes,
              note: nextDay.note,
            });
          } else {
            setNextProgramSession(null);
          }
        }
        setActiveProgramSession(null);
      } else {
        setNextProgramSession(null);
      }

      setShowCompletion(true);
      setIsBeginnerSession(false);
    }
    prevSessionDurationRef.current = sessionDuration;
  }, [
    isRunning,
    sessionDuration,
    totalBreaths,
    onboarding.hasLoaded,
    onboarding.hasCompletedFirstSession,
    selectedMode,
    activeProgramSession,
    completeDay,
    programProgress,
  ]);

  useEffect(() => {
    const rawFavorites = localStorage.getItem('sacred-breath-favorites');
    if (rawFavorites) {
      try {
        const parsed = JSON.parse(rawFavorites);
        if (Array.isArray(parsed)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setFavoriteModeIds(parsed.filter((id): id is string => typeof id === 'string'));
        }
      } catch {
        console.warn('Invalid sacred-breath-favorites localStorage payload');
      }
    }

    const rawLast = localStorage.getItem('sacred-breath-last-session');
    if (rawLast) {
      try {
        const parsed = JSON.parse(rawLast);
        if (
          parsed &&
          typeof parsed.modeId === 'string' &&
          (parsed.duration === 'free' || parsed.duration === 5 || parsed.duration === 10 || parsed.duration === 15)
        ) {
          setLastSession(parsed as LastSession);
        }
      } catch {
        console.warn('Invalid sacred-breath-last-session localStorage payload');
      }
    }
  }, []);
  const phaseProgress = earlyPhaseProgress;

  // Phase-aware intensity: rises 0→1 on inhale, holds at ~1, falls 1→0 on
  // exhale, rests at a gentle level during hold2. This drives lotus bloom,
  // ribbon brightness, and aura brightness in the shader.
  const intensity =
    currentPhase === 'inhale' ? phaseProgress :
    currentPhase === 'hold1'  ? 1.0 :
    currentPhase === 'exhale' ? 1.0 - phaseProgress :
    0.3;  // gentle hold2 level (stable, no impure Date.now in render)

  const chakraPhase = chakraLabels.indexOf(currentPhase);

  const phaseColors: Record<string, string> = {
    inhale: 'text-cyan-400',
    hold1: 'text-purple-400',
    exhale: 'text-orange-400',
    hold2: 'text-violet-400',
  };

  const activeMuscleCues = isBeginnerSession
    ? BEGINNER_MUSCLE_CUES
    : selectedMode.technique.phaseCues;
  const nextStepSuggestion = completionMeta
    ? NEXT_STEP_BY_MODE[completionMeta.modeId] ?? DEFAULT_NEXT_STEP
    : DEFAULT_NEXT_STEP;

  const burstColors: Record<string, string> = {
    inhale: '#fa7e1e',
    hold1: '#f4d35e',
    exhale: '#2ecc71',
    hold2: '#5b3cc4',
  };

  return (
    <main className="min-h-dvh bg-[#05010a] text-white relative overflow-hidden">
      <OfflineIndicator />

      <EnvironmentBackground
        environmentId={activeEnvironmentId}
        theme={selectedMode.theme}
        chakraPhase={chakraPhase}
      />

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

      <div
        className={`absolute inset-0 z-[2] ${hasEnvironment ? 'mix-blend-screen' : ''}`}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const dpr = window.devicePixelRatio || 1;
          const canvasW = rect.width * dpr;
          const canvasH = rect.height * dpr;
          const px = (e.clientX - rect.left) * dpr;
          const py = (e.clientY - rect.top) * dpr;
          setMouse({
            x: (px - canvasW / 2) / canvasH,
            y: (py - canvasH / 2) / canvasH,
          });
          setMouseStrength(0.7);
          const now = Date.now();
          if (now - lastRippleRef.current > 100) {
            lastRippleRef.current = now;
            playRipple(0.6);
          }
        }}
        onPointerLeave={() => {
          setMouse({ x: -2, y: -2 });
          setMouseStrength(0);
        }}
        onPointerUp={() => {
          setMouse({ x: -2, y: -2 });
          setMouseStrength(0);
        }}
      >
        <WebGPUShader
          breathPhase={breathPhase}
          intensity={intensity}
          chakraPhase={chakraPhase}
          phaseProgress={phaseProgress}
          theme={selectedMode.theme}
          mandalaStyle={selectedMode.mandalaStyle}
          figurePose={selectedMode.figurePose}
          mouse={mouse}
          mouseStrength={mouseStrength}
          timeScale={1.0}
          strengthLevel={selectedMode.strengthLevel ?? 1.0}
          chakraFocus={selectedMode.chakraFocusIndex}
          geometryDensity={selectedMode.geometryDensity ?? 1.0}
          interference={selectedMode.interference ?? 0.5}
          qualityPreset={
            effectivePerformanceMode === 'performance' ? 0 :
            effectivePerformanceMode === 'quality' ? 1 :
            selectedMode.qualityPreset
          }
          maxDevicePixelRatio={
            effectivePerformanceMode === 'performance' ? 1 :
            effectivePerformanceMode === 'quality' ? 2 :
            selectedMode.maxDevicePixelRatio
          }
          overlayEnabled={
            effectivePerformanceMode === 'performance' ? false :
            effectivePerformanceMode === 'quality' ? true :
            true
          }
          reducedMotion={rendererSettings.reducedMotion || isPerformanceForced}
          shaderPath={selectedMode.shaderPath}
          vertexEntry={selectedMode.vertexEntry}
          fragmentEntry={selectedMode.fragmentEntry}
          onDiagnostics={setRendererDiagnostics}
          className="w-full h-full"
        />
      </div>

      <div
        className="pointer-events-none fixed inset-0 z-[5]"
        style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.42) 100%)' }}
      />

      <ParticleBurst
        phase={currentPhase}
        isRunning={isRunning}
        color={selectedMode.accentColor ?? burstColors[currentPhase]}
      />

      <div className="fixed top-0 inset-x-0 z-20 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2 bg-gradient-to-b from-black/55 to-transparent">
        <div className="max-w-md mx-auto flex items-start justify-between gap-3">
          <div className="rounded-2xl bg-black/20 backdrop-blur-md border border-white/10 px-3 py-2">
            <h1 className="text-lg font-light tracking-[3px] text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.8)]">SACRED BREATH</h1>
            <p className="text-white/75 text-[10px] tracking-widest [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">meditate • align • flow</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-2xl bg-black/20 backdrop-blur-md border border-white/10 px-2.5 py-2 leading-none">
              <div className="text-cyan-300/95 text-sm tabular-nums [text-shadow:0_1px_8px_rgba(0,0,0,0.8)]">{stats.todayMinutes}</div>
              <div className="text-white/75 text-[9px] tracking-wider mt-1 [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">MIN TODAY</div>
            </div>
            <div className="rounded-2xl bg-black/20 backdrop-blur-md border border-white/10 px-2.5 py-2 leading-none">
              <div className="text-purple-300/95 text-sm tabular-nums [text-shadow:0_1px_8px_rgba(0,0,0,0.8)]">{stats.todayBreaths}</div>
              <div className="text-white/75 text-[9px] tracking-wider mt-1 [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">BREATHS</div>
            </div>
            <div className="rounded-2xl bg-black/20 backdrop-blur-md border border-white/10 px-2.5 py-2 leading-none">
              <div className="text-orange-300/95 text-sm tabular-nums [text-shadow:0_1px_8px_rgba(0,0,0,0.8)]">{stats.currentStreak}🔥</div>
              <div className="text-white/75 text-[9px] tracking-wider mt-1 [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">STREAK</div>
            </div>
            <ExportStats
              todayMinutes={stats.todayMinutes}
              todayBreaths={stats.todayBreaths}
              currentStreak={stats.currentStreak}
            />
          </div>
        </div>
      </div>

      <div className="relative z-10 min-h-dvh flex flex-col items-center justify-center pointer-events-none px-4">
        <div className={`text-5xl font-light uppercase tracking-[6px] transition-all duration-700 [text-shadow:0_2px_12px_rgba(0,0,0,0.85)] ${phaseColors[currentPhase]}`} data-tour="phase">
          {currentPhase}
        </div>
        <div className="text-7xl font-mono font-light text-white/95 mt-2 tabular-nums [text-shadow:0_2px_16px_rgba(0,0,0,0.9)]" data-tour="countdown">
          {Math.max(0, remaining).toFixed(0).padStart(2, '0')}
        </div>

        <div className="relative w-64 h-64 mt-6" data-tour="ring">
          <svg className="w-64 h-64 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#1a0f2e" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeDasharray="282.743"
              strokeDashoffset={282.743 * (1 - breathPhase)}
              strokeLinecap="round"
              className={`transition-all duration-300 ${phaseColors[currentPhase]}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="w-28 h-28 flex items-center justify-center">
              <BreathingAvatar
                currentPhase={currentPhase}
                phaseProgress={phaseProgress}
                totalBreaths={totalBreaths}
                figurePose={selectedMode.figurePose}
              />
            </div>
            <div className="absolute -bottom-8 w-64 text-center" data-tour="controls">
              <p className="text-[11px] uppercase tracking-[2px] text-white/50 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/5 animate-pulse motion-reduce:animate-none">
                {activeMuscleCues[currentPhase]}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 z-20 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/70 to-transparent backdrop-blur-md">
        <div className="max-w-md mx-auto flex flex-col gap-3">
          {!isRunning && lastSession && (
            <button
              onClick={() => {
                const mode = SESSION_MODES.find((entry) => entry.id === lastSession.modeId);
                if (!mode) return;
                handleModeStart(mode, lastSession.duration);
              }}
              className="w-full py-2 rounded-xl bg-black/25 border border-white/20 hover:bg-black/35 transition-all text-[10px] tracking-widest text-white/90 [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]"
            >
              ↻ RESUME {SESSION_MODES.find((entry) => entry.id === lastSession.modeId)?.technique.commonName.toUpperCase() ?? 'LAST TECHNIQUE'} · {lastSession.duration === 'free' ? 'FREE' : `${lastSession.duration} MIN`}
            </button>
          )}

          <ProgramNextSessionCard
            activeProgramId={activeProgramId}
            activeProgress={programProgress}
            isRunning={isRunning}
            onOpenSelector={() => setShowProgramSelector(true)}
            onStartSession={handleStartProgramSession}
          />

          <SessionModeSwitcher
            modes={sortedModes}
            selectedModeId={selectedMode.id}
            isRunning={isRunning}
            activeBreath={settings}
            favoriteModeIds={favoriteModeIds}
            onSelect={handleModeSelect}
            onStart={handleModeStart}
            onNudge={handleNudge}
            onSetPhaseDuration={handleSetPhaseDuration}
            onToggleFavorite={toggleFavoriteMode}
          />

          <div className="flex gap-2">
            {[5, 10, 15].map(min => (
              <button
                key={min}
                onClick={() => handleQuickStart(min as 5 | 10 | 15)}
                className="flex-1 py-3 bg-black/20 backdrop-blur-md hover:bg-black/30 border border-white/20 rounded-2xl text-xs tracking-widest transition-all active:scale-95 text-white/95 [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]"
              >
                {min} MIN
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBeginPause}
              className="flex-1 py-4 text-base font-light tracking-widest bg-gradient-to-r from-cyan-500 to-purple-600 rounded-3xl hover:brightness-110 transition-all active:scale-95 shadow-2xl shadow-purple-500/30 text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]"
            >
              {isRunning ? 'PAUSE' : 'BEGIN'}
            </button>
            <button onClick={reset} className="px-4 py-4 text-sm font-light tracking-widest border border-white/30 rounded-3xl bg-black/20 backdrop-blur-md hover:bg-black/30 transition-all text-white/95 [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">
              ↺
            </button>
            <button
              onClick={toggleVoice}
              className={`px-4 py-4 text-xl border rounded-3xl transition-all backdrop-blur-md [text-shadow:0_1px_6px_rgba(0,0,0,0.8)] ${voiceSettings.enabled ? 'bg-black/20 border-white/30 hover:bg-black/30' : 'bg-black/10 border-white/10 opacity-40'}`}
              title={voiceSettings.enabled ? 'Voice guidance on' : 'Voice guidance off'}
            >
              🗣️
            </button>
            <button
              onClick={toggleSanskrit}
              className={`px-4 py-4 text-xs font-light border rounded-3xl transition-all backdrop-blur-md [text-shadow:0_1px_6px_rgba(0,0,0,0.8)] ${voiceSettings.useSanskrit ? 'bg-black/30 border-purple-300 text-purple-200' : 'bg-black/20 border-white/30 hover:bg-black/30 text-white/95'}`}
              title={voiceSettings.useSanskrit ? 'Sanskrit mode' : 'English mode'}
            >
              {voiceSettings.useSanskrit ? 'सं' : 'EN'}
            </button>
            {canUseInstructor && (
              <button
                onClick={toggleInstructorEnabled}
                className={`px-4 py-4 text-xl border rounded-3xl transition-all backdrop-blur-md [text-shadow:0_1px_6px_rgba(0,0,0,0.8)] ${
                  instructorSettings.enabled
                    ? 'bg-cyan-500/25 border-cyan-300/60 text-cyan-100'
                    : 'bg-black/20 border-white/30 hover:bg-black/30 text-white/95 opacity-60'
                }`}
                title={instructorSettings.enabled ? 'Hide instructor guide' : 'Show instructor guide'}
              >
                🧘
              </button>
            )}
            <button onClick={() => setShowDrawer(true)} className="px-4 py-4 text-xl border border-white/30 rounded-3xl bg-black/20 backdrop-blur-md hover:bg-black/30 transition-all text-white/95 [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">
              ⚙️
            </button>
          </div>
        </div>
      </div>

      {onboarding.shouldShowWelcome && !isRunning && !showIntroTour && (
        <WelcomePanel
          onQuickStart={handleBeginnerQuickStart}
          onTakeTour={() => {
            setStartAfterTour(true);
            setShowIntroTour(true);
          }}
          onExplore={() => onboarding.dismissWelcome(false)}
          onSkipForever={() => onboarding.dismissWelcome(true)}
        />
      )}

      {showIntroTour && (
        <PracticeIntroTour
          onComplete={handleIntroTourComplete}
          onSkip={handleIntroTourSkip}
        />
      )}

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
        onSelect={(programId) => {
          selectProgram(programId);
          setShowProgramSelector(false);
        }}
        onAbandon={() => {
          abandonProgram();
          setShowProgramSelector(false);
        }}
        onReset={() => {
          resetProgram();
          setShowProgramSelector(false);
        }}
      />

      {/* Custom settings drawer */}
      {showDrawer && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
          <div className="bg-[#0f081f] w-full max-w-md mx-auto rounded-t-3xl p-6 text-white">
            <h2 className="text-2xl font-light mb-6">Customize Breath</h2>

            <div className="mb-8">
              <p className="text-sm text-white/60 mb-3 tracking-wider">ENVIRONMENT</p>
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={() => setEnvironmentOverride('auto')}
                  className={`px-3 py-2 rounded-xl text-xs tracking-wider border transition-all ${
                    environmentOverride === 'auto'
                      ? 'bg-purple-500/30 border-purple-300 text-purple-100'
                      : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
                  }`}
                >
                  AUTO (MODE)
                </button>
                {ENVIRONMENTS.map((env) => (
                  <button
                    key={env.id}
                    onClick={() => setEnvironmentOverride(env.id)}
                    className={`px-3 py-2 rounded-xl text-xs tracking-wider border transition-all ${
                      environmentOverride === env.id
                        ? 'bg-purple-500/30 border-purple-300 text-purple-100'
                        : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {env.emoji} {env.label.toUpperCase()}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-white/45 leading-relaxed">
                {environmentOverride === 'auto'
                  ? `Following ${selectedMode.label} — ${ENVIRONMENTS.find((e) => e.id === (selectedMode.backgroundId ?? 'none'))?.label ?? 'Cosmic Void'}`
                  : 'Manual environment — persists across sessions'}
              </p>
            </div>

            {canUseInstructor && (
              <div className="mb-8">
                <p className="text-sm text-white/60 mb-3 tracking-wider">INSTRUCTOR GUIDE</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    onClick={() => updateInstructorSettings({ enabled: !instructorSettings.enabled })}
                    className={`px-3 py-2 rounded-xl text-xs tracking-wider border transition-all ${
                      instructorSettings.enabled
                        ? 'bg-cyan-500/30 border-cyan-300 text-cyan-100'
                        : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {instructorSettings.enabled ? 'ON' : 'OFF'}
                  </button>
                  {(['pip', 'underlay'] as const).map((layout) => (
                    <button
                      key={layout}
                      onClick={() => updateInstructorSettings({ layout })}
                      className={`px-3 py-2 rounded-xl text-xs tracking-wider border transition-all ${
                        instructorSettings.layout === layout
                          ? 'bg-purple-500/30 border-purple-300 text-purple-100'
                          : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {layout === 'pip' ? 'PICTURE IN PICTURE' : 'SOFT UNDERLAY'}
                    </button>
                  ))}
                </div>
                {instructorSettings.layout === 'pip' && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(['sm', 'md', 'lg'] as const).map((pipSize) => (
                      <button
                        key={pipSize}
                        onClick={() => updateInstructorSettings({ pipSize })}
                        className={`px-3 py-2 rounded-xl text-xs tracking-wider border transition-all ${
                          instructorSettings.pipSize === pipSize
                            ? 'bg-purple-500/30 border-purple-300 text-purple-100'
                            : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        {pipSize.toUpperCase()}
                      </button>
                    ))}
                    {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((pipCorner) => (
                      <button
                        key={pipCorner}
                        onClick={() => updateInstructorSettings({ pipCorner, pipDragOffset: { x: 0, y: 0 } })}
                        className={`px-3 py-2 rounded-xl text-xs tracking-wider border transition-all ${
                          instructorSettings.pipCorner === pipCorner
                            ? 'bg-purple-500/30 border-purple-300 text-purple-100'
                            : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        {pipCorner.replace('-', ' ').toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
                <label className="flex items-center gap-3 text-sm text-white/70 mb-2">
                  <input
                    type="checkbox"
                    checked={instructorSettings.audioEnabled}
                    onChange={(e) => updateInstructorSettings({ audioEnabled: e.target.checked })}
                    className="accent-cyan-400"
                  />
                  Instructor audio (muted when voice guidance is on)
                </label>
                <p className="text-[11px] text-white/45 leading-relaxed">
                  Drag the PiP window to reposition. Video pauses when practice is paused.
                </p>
              </div>
            )}

            <div className="mb-8">
              <p className="text-sm text-white/60 mb-3 tracking-wider">RENDERER</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {(['auto', 'performance', 'quality'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => updateRendererSettings({ performanceMode: mode })}
                    className={`px-3 py-2 rounded-xl text-xs tracking-wider border transition-all ${
                      effectivePerformanceMode === mode
                        ? 'bg-emerald-500/30 border-emerald-300 text-emerald-100'
                        : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {mode === 'auto' && 'AUTO'}
                    {mode === 'performance' && 'PERFORMANCE'}
                    {mode === 'quality' && 'QUALITY'}
                    {isPerformanceForced && mode === 'performance' && ' (forced)'}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-3 text-sm text-white/70 mb-2">
                <input
                  type="checkbox"
                  checked={rendererSettings.reducedMotion}
                  onChange={(e) => updateRendererSettings({ reducedMotion: e.target.checked })}
                  className="accent-emerald-400"
                />
                Reduced motion (lowers detail & disables overlay)
              </label>
              <label className="flex items-center gap-3 text-sm text-white/70 mb-2">
                <input
                  type="checkbox"
                  checked={rendererSettings.showDiagnostics}
                  onChange={(e) => updateRendererSettings({ showDiagnostics: e.target.checked })}
                  className="accent-emerald-400"
                />
                Show renderer diagnostics
              </label>
              <p className="text-[11px] text-white/45 leading-relaxed">
                {effectivePerformanceMode === 'auto'
                  ? 'Following technique defaults.'
                  : effectivePerformanceMode === 'performance'
                    ? 'Capped resolution, lower detail, no overlay.'
                    : 'Maximum detail, overlay enabled.'}
              </p>
            </div>

            {(['inhale', 'hold1', 'exhale', 'hold2'] as const).map((key) => (
              <div key={key} className="flex items-center gap-4 mb-6">
                <span className="w-20 capitalize text-white/70">{key}</span>
                <input
                  type="range"
                  min="0"
                  max={key === 'hold2' ? 10 : 15}
                  value={settings[key]}
                  onChange={(e) => updateSettings({ [key]: parseInt(e.target.value) })}
                  className="flex-1 accent-purple-500"
                />
                <span className="font-mono w-8 text-right">{settings[key]}s</span>
              </div>
            ))}
            <button
              onClick={() => setShowDrawer(false)}
              className="w-full py-4 mt-4 bg-white/10 hover:bg-white/20 rounded-3xl text-lg font-light"
            >
              DONE
            </button>
          </div>
        </div>
      )}

      {rendererSettings.showDiagnostics && (
        <RendererDiagnostics state={rendererDiagnostics} />
      )}

      {/* Global PWA install prompt (listens for beforeinstallprompt) */}
      <InstallPrompt />
    </main>
  );
}
