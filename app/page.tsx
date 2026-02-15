'use client';

import { useState } from 'react';
import WebGPUShader from './components/WebGPUShader';
import BreathTimer from './components/BreathTimer';
import PostureGuide from './components/PostureGuide';
import { useBreathTimer, PHASE_CHAKRAS } from './hooks/useBreathTimer';

export default function Home() {
  const [showShader, setShowShader] = useState(true);
  
  const { state, actions } = useBreathTimer({
    strengthLevel: 'light',
    autoStart: true,
  });

  const handleTogglePause = () => {
    if (state.isRunning) {
      actions.pause();
    } else {
      actions.start();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      {/* Header */}
      <header className="pt-8 pb-4 px-4 text-center">
        <h1 className="text-5xl font-bold text-white mb-2 drop-shadow-lg">
          Yoga Studio
        </h1>
        <p className="text-xl text-purple-200">
          Sacred Breath Timer
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
                <button
                  onClick={() => setShowShader(!showShader)}
                  className="text-xs px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-purple-200 transition-colors"
                >
                  {showShader ? 'Hide' : 'Show'}
                </button>
              </div>
              
              {showShader && (
                <div className="aspect-[4/3] rounded-lg overflow-hidden">
                  <WebGPUShader 
                    breathState={state}
                    width={800}
                    height={600}
                  />
                </div>
              )}
              
              {!showShader && (
                <div className="aspect-[4/3] rounded-lg bg-black/50 flex items-center justify-center">
                  <p className="text-purple-300">Visualization hidden</p>
                </div>
              )}
              
              <p className="text-xs text-purple-400 mt-3 text-center">
                WebGPU-powered shader synchronized to your breath rhythm
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
                  <span className="w-3 h-3 rounded-full bg-purple-400" />
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
          <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Breath Timer
            </h2>
            
            <BreathTimer
              state={state}
              onStrengthChange={actions.setStrengthLevel}
              onTogglePause={handleTogglePause}
              onReset={actions.reset}
            />
            
            {/* Posture Guide */}
            <div className="mt-6">
              <PostureGuide 
                phase={state.phase}
                showDetails={true}
              />
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
              <li>Find a comfortable standing or seated position (Tadasana)</li>
              <li>Synchronize arm movements with breath phases</li>
              <li>Engage appropriate bandhas during holds</li>
              <li>Keep drishti (gaze) soft and steady</li>
              <li>Start with Light intensity, progress gradually</li>
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
              <p><strong className="text-white/70">Kumbhaka</strong> — Breath retention builds prana (life force) and strengthens the nervous system.</p>
              <p><strong className="text-white/70">Bandhas</strong> — Energy locks that direct prana flow: Mula (root), Uddiyana (navel), Jalandhara (throat).</p>
              <p><strong className="text-white/70">Nadis</strong> — Subtle energy channels: Ida (moon/left), Pingala (sun/right), Sushumna (central).</p>
              <p><strong className="text-white/70">This practice</strong> — A moving pranayama to circulate prana through the nadis while opening the heart and shoulders.</p>
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
              <p><strong className="text-white/70">Phase:</strong> <span className="capitalize">{state.phase.replace('-', ' ')}</span></p>
              <p><strong className="text-white/70">Primary Chakra:</strong> {state.activeChakra} ({PHASE_CHAKRAS[state.phase].significance})</p>
              {state.secondaryChakra && (
                <p><strong className="text-white/70">Secondary:</strong> {state.secondaryChakra}</p>
              )}
              <p><strong className="text-white/70">Cycle:</strong> {state.cycle + 1}</p>
              <div className="pt-2 border-t border-white/10 mt-2">
                <p className="italic text-white/50">&ldquo;{PHASE_CHAKRAS[state.phase].significance}&rdquo;</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center text-xs text-purple-400">
        <p>Sacred Breath Timer • Synchronize your breath with the rhythm</p>
      </footer>
    </div>
  );
}
