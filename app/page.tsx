'use client';

import { useState } from 'react';
import WebGPUShader from './components/WebGPUShader';
import { useBreathingTimer, DEFAULT_DURATIONS, type Durations, type Phase } from './hooks/useBreathingTimer';

const PHASE_DISPLAY: Record<Phase, { label: string; color: string; description: string }> = {
  inhale: { 
    label: 'INHALE', 
    color: 'text-cyan-400',
    description: 'Breathe in deeply through your nose'
  },
  hold1: { 
    label: 'HOLD', 
    color: 'text-yellow-400',
    description: 'Hold the breath gently'
  },
  exhale: { 
    label: 'EXHALE', 
    color: 'text-orange-400',
    description: 'Breathe out slowly through your mouth'
  },
  hold2: { 
    label: 'HOLD', 
    color: 'text-emerald-400',
    description: 'Rest with empty lungs'
  },
};

export default function Home() {
  const [durations, setDurations] = useState<Durations>(DEFAULT_DURATIONS);
  const timer = useBreathingTimer(durations);
  
  const phaseInfo = PHASE_DISPLAY[timer.currentPhase];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="pt-8 pb-4 px-4 text-center">
        <h1 className="text-5xl font-bold text-white mb-2 drop-shadow-lg">
          Sacred Breath
        </h1>
        <p className="text-xl text-purple-200">
          Synchronize your breath with the rhythm
        </p>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          
          {/* Left: Shader Visualization */}
          <div className="space-y-4">
            <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                  Visualization
                </h2>
              </div>
              
              <div className="aspect-square rounded-lg overflow-hidden relative">
                <WebGPUShader
                  breathState={{
                    phase: timer.currentPhase,
                    progress: timer.phaseProgress,
                    isRunning: timer.isRunning,
                    activeChakra: timer.currentPhase === 'inhale' ? 'Anahata' : 
                                  timer.currentPhase === 'hold1' ? 'Manipura' :
                                  timer.currentPhase === 'exhale' ? 'Muladhara' : 'Sahasrara',
                  }}
                  width={800}
                  height={800}
                />
                
                {/* Overlay phase info */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-center bg-black/40 backdrop-blur-sm rounded-2xl px-8 py-6 border border-white/10">
                    <p className={`text-4xl font-bold ${phaseInfo.color} mb-2`}>
                      {phaseInfo.label}
                    </p>
                    <p className="text-5xl font-light text-white tabular-nums">
                      {timer.timeLeftInPhase}s
                    </p>
                  </div>
                </div>
              </div>
              
              <p className="text-xs text-purple-400 mt-3 text-center">
                WebGPU-powered breathing visualization
              </p>
            </div>
            
            {/* Phase Legend */}
            <div className="bg-black/20 backdrop-blur-sm rounded-xl p-4 border border-white/5">
              <h3 className="text-sm font-medium text-purple-200 mb-3">Breath Phases</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-cyan-400" />
                  <span className="text-xs text-purple-300">Inhale - Expand</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-yellow-400" />
                  <span className="text-xs text-purple-300">Hold - Steady</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-orange-400" />
                  <span className="text-xs text-purple-300">Exhale - Release</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-400" />
                  <span className="text-xs text-purple-300">Hold - Empty</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right: Breath Timer Controls */}
          <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 border border-white/10 space-y-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Breath Controls
            </h2>
            
            {/* Current Phase Display */}
            <div className="text-center py-6 bg-black/20 rounded-xl border border-white/5">
              <p className="text-sm text-purple-300 mb-1">Current Phase</p>
              <p className={`text-3xl font-bold ${phaseInfo.color}`}>
                {phaseInfo.label}
              </p>
              <p className="text-sm text-purple-200 mt-1">
                {phaseInfo.description}
              </p>
            </div>
            
            {/* Timer Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
                <div className="text-xs text-purple-300 uppercase tracking-wide">Remaining</div>
                <div className="text-xl font-semibold text-white">
                  {timer.timeLeftInPhase}s
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
                <div className="text-xs text-purple-300 uppercase tracking-wide">Progress</div>
                <div className="text-xl font-semibold text-white">
                  {Math.round(timer.phaseProgress * 100)}%
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
                <div className="text-xs text-purple-300 uppercase tracking-wide">Cycles</div>
                <div className="text-xl font-semibold text-white">
                  {timer.cycleCount}
                </div>
              </div>
            </div>
            
            {/* Duration Controls */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-purple-200">Phase Durations (seconds)</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-purple-400 block mb-1">Inhale</label>
                  <input
                    type="range"
                    min="2"
                    max="10"
                    value={durations.inhale}
                    onChange={(e) => setDurations({ ...durations, inhale: Number(e.target.value) })}
                    className="w-full accent-cyan-400"
                  />
                  <span className="text-xs text-white">{durations.inhale}s</span>
                </div>
                <div>
                  <label className="text-xs text-purple-400 block mb-1">Hold</label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={durations.hold1}
                    onChange={(e) => setDurations({ ...durations, hold1: Number(e.target.value) })}
                    className="w-full accent-yellow-400"
                  />
                  <span className="text-xs text-white">{durations.hold1}s</span>
                </div>
                <div>
                  <label className="text-xs text-purple-400 block mb-1">Exhale</label>
                  <input
                    type="range"
                    min="2"
                    max="12"
                    value={durations.exhale}
                    onChange={(e) => setDurations({ ...durations, exhale: Number(e.target.value) })}
                    className="w-full accent-orange-400"
                  />
                  <span className="text-xs text-white">{durations.exhale}s</span>
                </div>
                <div>
                  <label className="text-xs text-purple-400 block mb-1">Hold Empty</label>
                  <input
                    type="range"
                    min="0"
                    max="8"
                    value={durations.hold2}
                    onChange={(e) => setDurations({ ...durations, hold2: Number(e.target.value) })}
                    className="w-full accent-emerald-400"
                  />
                  <span className="text-xs text-white">{durations.hold2}s</span>
                </div>
              </div>
            </div>
            
            {/* Control Buttons */}
            <div className="flex gap-3">
              <button
                onClick={timer.isRunning ? timer.pause : timer.start}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                  timer.isRunning
                    ? 'bg-amber-500/80 hover:bg-amber-500 text-white'
                    : 'bg-emerald-500/80 hover:bg-emerald-500 text-white'
                }`}
              >
                {timer.isRunning ? 'Pause' : 'Start Sacred Breath'}
              </button>
              <button
                onClick={timer.reset}
                className="px-4 py-3 rounded-lg font-medium bg-white/10 hover:bg-white/20 text-purple-200 transition-all duration-200"
              >
                Reset
              </button>
            </div>
            
            {/* Cycle Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-purple-300">
                <span>Cycle Progress</span>
                <span>{Math.round(timer.globalProgress * 100)}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-400 via-yellow-400 via-orange-400 to-emerald-400 transition-all duration-100 ease-linear"
                  style={{ width: `${timer.globalProgress * 100}%` }}
                />
              </div>
              
              {/* Phase indicators */}
              <div className="flex justify-between pt-1">
                {(['inhale', 'hold1', 'exhale', 'hold2'] as Phase[]).map((phase) => (
                  <div 
                    key={phase}
                    className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                      timer.currentPhase === phase ? 'bg-white shadow-lg shadow-white/50' : 'bg-white/20'
                    }`}
                    title={PHASE_DISPLAY[phase].label}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Bottom Section: Educational Content */}
        <div className="mt-8 grid md:grid-cols-3 gap-6">
          {/* Practice Guidelines */}
          <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <h3 className="text-sm font-medium text-purple-200 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Practice Guidelines
            </h3>
            <ol className="text-xs text-purple-300 space-y-2 list-decimal list-inside">
              <li>Find a comfortable seated or lying position</li>
              <li>Follow the expanding/contracting circle with your breath</li>
              <li>Inhale as the circle expands, exhale as it contracts</li>
              <li>Keep your breath smooth and continuous</li>
              <li>Start with shorter durations, increase gradually</li>
              <li>Practice for 5-20 minutes daily</li>
            </ol>
          </div>
          
          {/* Pranayama Knowledge */}
          <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <h3 className="text-sm font-medium text-purple-200 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Pranayama Wisdom
            </h3>
            <div className="text-xs text-purple-300 space-y-2">
              <p><strong className="text-white/70">Box Breathing</strong> — Equal inhalation, hold, exhalation, and hold creates balance and calm.</p>
              <p><strong className="text-white/70">4-7-8 Breathing</strong> — Inhale for 4, hold for 7, exhale for 8 to activate the parasympathetic nervous system.</p>
              <p><strong className="text-white/70">Coherent Breathing</strong> — 5-6 breaths per minute optimizes heart rate variability.</p>
              <p><strong className="text-white/70">This practice</strong> — Customize your own rhythm to match your body&apos;s natural flow.</p>
            </div>
          </div>
          
          {/* Current Phase Info */}
          <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <h3 className="text-sm font-medium text-purple-200 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Current Phase Focus
            </h3>
            <div className="text-xs text-purple-300 space-y-2">
              <p><strong className="text-white/70">Phase:</strong> <span className={phaseInfo.color}>{phaseInfo.label}</span></p>
              <p><strong className="text-white/70">Progress:</strong> {Math.round(timer.phaseProgress * 100)}% complete</p>
              <p><strong className="text-white/70">Cycles completed:</strong> {timer.cycleCount}</p>
              <div className="pt-2 border-t border-white/10 mt-2">
                <p className="italic text-white/50">&ldquo;{phaseInfo.description}&rdquo;</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center text-xs text-purple-400">
        <p>Sacred Breath Timer • Find your rhythm</p>
      </footer>
    </div>
  );
}
