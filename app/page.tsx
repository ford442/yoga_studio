'use client';

import React, { useState, useEffect, useRef } from 'react';
import WebGPUShader from './components/WebGPUShader';
import InstallPrompt from './components/InstallPrompt';
import ExportStats from './components/ExportStats';
import CompletionScreen from './components/CompletionScreen';
import ThemeSwitcher from './components/ThemeSwitcher';
import { useBreathTimer, type BreathSettings } from './hooks/useBreathTimer';
import { useBreathAudio } from './hooks/useBreathAudio';
import { useSessionStats } from './hooks/useSessionStats';
import { useVoiceGuidance } from './hooks/useVoiceGuidance';
import { useRippleAudio } from './hooks/useRippleAudio';

const presets: Record<string, BreathSettings> = {
  box: { inhale: 4, hold1: 4, exhale: 4, hold2: 4 },
  '478': { inhale: 4, hold1: 7, exhale: 8, hold2: 0 },
  sigh: { inhale: 4, hold1: 0, exhale: 6, hold2: 8 },
  free: { inhale: 5, hold1: 3, exhale: 7, hold2: 2 },
};

const chakraLabels = ['inhale', 'hold1', 'exhale', 'hold2'];

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
    endSession,
  } = useBreathTimer();

  const totalCycle = settings.inhale + settings.hold1 + settings.exhale + settings.hold2;

  const { toggleMute, isMuted } = useBreathAudio(currentPhase, isRunning);
  const { stats, addPracticeTime } = useSessionStats();
  const { settings: voiceSettings, toggleVoice, toggleSanskrit } = useVoiceGuidance(currentPhase, isRunning);

  const [showDrawer, setShowDrawer] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [theme, setTheme] = useState(0);
  const [mandalaStyle, setMandalaStyle] = useState(0);
  const [mouse, setMouse] = useState({ x: -2, y: -2 });
  const [mouseStrength, setMouseStrength] = useState(0);
  const { playRipple } = useRippleAudio();
  const lastRippleRef = useRef(0);

  // Detect full breath cycle completion (hold2 → inhale transition)
  const prevPhaseRef = useRef(currentPhase);
  useEffect(() => {
    if (prevPhaseRef.current === 'hold2' && currentPhase === 'inhale') {
      addPracticeTime(totalCycle);
    }
    prevPhaseRef.current = currentPhase;
  }, [currentPhase, totalCycle, addPracticeTime]);

  // Show completion screen when a timed session ends
  useEffect(() => {
    if (!isRunning && sessionDuration !== null && totalBreaths > 0) {
      setShowCompletion(true);
    }
  }, [isRunning, sessionDuration, totalBreaths]);
  const elapsedInCycle = (breathPhase * totalCycle) % totalCycle;
  let remaining = 0;
  if (currentPhase === 'inhale') remaining = settings.inhale - elapsedInCycle;
  else if (currentPhase === 'hold1') remaining = settings.hold1 - (elapsedInCycle - settings.inhale);
  else if (currentPhase === 'exhale') remaining = settings.exhale - (elapsedInCycle - settings.inhale - settings.hold1);
  else remaining = settings.hold2 - (elapsedInCycle - settings.inhale - settings.hold1 - settings.exhale);

  // Compute how far through the current phase we are (0..1), used by
  // the shader for accurate petal-bloom and ribbon timing.
  const phaseDuration =
    currentPhase === 'inhale' ? settings.inhale :
    currentPhase === 'hold1'  ? settings.hold1  :
    currentPhase === 'exhale' ? settings.exhale  :
    settings.hold2;
  const phaseElapsed = phaseDuration > 0
    ? Math.max(0, phaseDuration - Math.max(0, remaining))
    : 0;
  const phaseProgress = phaseDuration > 0
    ? Math.min(1, phaseElapsed / phaseDuration)
    : 0;

  // Phase-aware intensity: rises 0→1 on inhale, holds at ~1, falls 1→0 on
  // exhale, rests at a gentle pulse during hold2. This drives lotus bloom,
  // ribbon brightness, and aura brightness in the shader.
  const intensity =
    currentPhase === 'inhale' ? phaseProgress :
    currentPhase === 'hold1'  ? 1.0 :
    currentPhase === 'exhale' ? 1.0 - phaseProgress :
    0.25 + 0.15 * Math.sin(Date.now() / 1200);  // gentle hold2 pulse

  const chakraPhase = chakraLabels.indexOf(currentPhase);

  const phaseColors: Record<string, string> = {
    inhale: 'text-cyan-400',
    hold1: 'text-purple-400',
    exhale: 'text-orange-400',
    hold2: 'text-violet-400',
  };

  return (
    <main className="min-h-screen bg-[#05010a] text-white flex flex-col items-center justify-center relative overflow-hidden">
      <div
        className="absolute inset-0 z-0"
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
          theme={theme}
          mandalaStyle={mandalaStyle}
          mouse={mouse}
          mouseStrength={mouseStrength}
          timeScale={1.0}
          className="w-full h-full"
        />
      </div>

      <div className="relative z-10 w-full max-w-md mx-auto px-6 py-12 flex flex-col items-center text-center">
        <h1 className="text-4xl font-light tracking-[4px] mb-2 text-white/90">SACRED BREATH</h1>
        <p className="text-white/40 text-sm tracking-widest mb-6">meditate • align • flow</p>

        {/* Session duration buttons */}
        <div className="flex gap-3 mb-8">
          {[5, 10, 15].map(min => (
            <button
              key={min}
              onClick={() => startSession(min as any)}
              className="flex-1 py-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-3xl text-sm tracking-widest transition-all active:scale-95"
            >
              {min} MIN
            </button>
          ))}
        </div>

        <div className="mb-8">
          <div className={`text-5xl font-light uppercase tracking-[6px] transition-all duration-700 ${phaseColors[currentPhase]}`}>
            {currentPhase}
          </div>
          <div className="text-7xl font-mono font-light text-white/80 mt-2 tabular-nums">
            {Math.max(0, remaining).toFixed(0).padStart(2, '0')}
          </div>
        </div>

        <div className="relative w-64 h-64 mb-10">
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
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 flex items-center justify-center text-6xl">
              🧘‍♂️
            </div>
          </div>
        </div>

        {/* Live Session Stats */}
        <div className="flex justify-center gap-8 mb-8 text-sm">
          <div className="text-center">
            <div className="text-2xl font-light text-cyan-400 tabular-nums">{stats.todayMinutes}</div>
            <div className="text-[10px] text-white/40 tracking-widest">MIN TODAY</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-light text-purple-400 tabular-nums">{stats.todayBreaths}</div>
            <div className="text-[10px] text-white/40 tracking-widest">BREATHS</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-light text-orange-400 tabular-nums flex items-center justify-center gap-1">
              {stats.currentStreak} <span className="text-lg">🔥</span>
            </div>
            <div className="text-[10px] text-white/40 tracking-widest">STREAK</div>
          </div>
        </div>

        <div className="mb-6">
          <ThemeSwitcher
            theme={theme}
            mandalaStyle={mandalaStyle}
            onThemeChange={setTheme}
            onStyleChange={setMandalaStyle}
          />
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {Object.entries(presets).map(([name, preset]) => (
            <button
              key={name}
              onClick={() => { updateSettings(preset); if (!isRunning) toggleFree(); }}
              className="px-5 py-2.5 text-sm font-light tracking-wider bg-white/10 hover:bg-white/20 border border-white/20 rounded-3xl transition-all active:scale-95"
            >
              {name.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="mb-6">
          <ExportStats
            todayMinutes={stats.todayMinutes}
            todayBreaths={stats.todayBreaths}
            currentStreak={stats.currentStreak}
          />
        </div>

        <div className="flex items-center gap-4">
          <button onClick={toggleFree} className="px-10 py-4 text-xl font-light tracking-widest bg-gradient-to-r from-cyan-500 to-purple-600 rounded-3xl hover:brightness-110 transition-all active:scale-95 shadow-2xl shadow-purple-500/30">
            {isRunning ? 'PAUSE' : 'BEGIN'}
          </button>
          <button onClick={reset} className="px-8 py-4 text-sm font-light tracking-widest border border-white/30 rounded-3xl hover:bg-white/10 transition-all">RESET</button>
          <button
            onClick={toggleVoice}
            className={`px-4 py-4 text-2xl border rounded-3xl transition-all ${voiceSettings.enabled ? 'border-white/30 hover:bg-white/10' : 'border-white/10 opacity-40'}`}
            title={voiceSettings.enabled ? "Voice guidance on" : "Voice guidance off"}
          >
            🗣️
          </button>

          <button
            onClick={toggleSanskrit}
            className={`px-4 py-4 text-xs font-light border rounded-3xl transition-all ${voiceSettings.useSanskrit ? 'border-purple-400 text-purple-400' : 'border-white/30 hover:bg-white/10'}`}
            title={voiceSettings.useSanskrit ? "Sanskrit mode" : "English mode"}
          >
            {voiceSettings.useSanskrit ? 'सं' : 'EN'}
          </button>

          <button onClick={() => setShowDrawer(true)} className="px-4 py-4 text-2xl border border-white/30 rounded-3xl hover:bg-white/10 transition-all">⚙️</button>
        </div>
      </div>

      {/* Custom settings drawer */}
      {showDrawer && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
          <div className="bg-[#0f081f] w-full max-w-md mx-auto rounded-t-3xl p-6 text-white">
            <h2 className="text-2xl font-light mb-6">Customize Breath</h2>
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
    </main>
  );
}
