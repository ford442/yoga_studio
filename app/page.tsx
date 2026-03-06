'use client';

import { useState, useRef, useEffect } from 'react';
import WebGPUShader, { WebGPUShaderRef } from './components/WebGPUShader';
import PostureGuide from './components/PostureGuide';
import { useSacredBreathTimer, type Phase } from './hooks/useSacredBreathTimer';

const PHASE_DISPLAY: Record<Phase, { 
  label: string; 
  color: string; 
  instruction: string;
}> = {
  inhale: { 
    label: 'INHALE', 
    color: 'text-cyan-400',
    instruction: 'Raise arms overhead • Expand chest'
  },
  hold1: { 
    label: 'HOLD', 
    color: 'text-yellow-400',
    instruction: 'Arms extended • Engage bandhas • Feel the energy'
  },
  exhale: { 
    label: 'EXHALE', 
    color: 'text-orange-400',
    instruction: 'Lower arms gracefully • Release tension'
  },
  hold2: { 
    label: 'HOLD', 
    color: 'text-emerald-400',
    instruction: 'Complete relaxation • Experience shunya (void)'
  },
};

// Map phase to chakra index
const PHASE_CHAKRAS: Record<Phase, number> = {
  inhale: 3,   // Heart (Anahata)
  hold1: 2,    // Solar Plexus (Manipura)
  exhale: 0,   // Root (Muladhara)
  hold2: 6,    // Crown (Sahasrara)
};





export default function Home() {
  const [selectedStrength, setSelectedStrength] = useState<number>(0);
  const [showPosture, setShowPosture] = useState(true);
  
  const breath = useSacredBreathTimer(selectedStrength);
  
  // Map 0,1,2 to labels for display
  const strengthLabels = ['Light', 'Medium', 'Strong'];
  const shaderRef = useRef<WebGPUShaderRef>(null);
  const phaseInfo = PHASE_DISPLAY[breath.phase];

  // Update shader uniforms on each frame
  useEffect(() => {
    if (shaderRef.current) {
      shaderRef.current.updateUniforms(breath.getUniforms());
    }
  }, [breath.phaseProgress, breath.phase, breath.cycle, breath.isRunning, breath.getUniforms]);

  const handleStrengthChange = (level: number) => {
    setSelectedStrength(level);
    breath.changeStrengthLevel(level);
  };

  return (
    <div className="min-h-screen bg-black overflow-hidden">
      {/* Full-screen WebGPU Canvas */}
      <div className="fixed inset-0 z-0">
        <WebGPUShader ref={shaderRef} strengthLevel={selectedStrength} />
      </div>

      {/* Sacred Geometry Overlay UI */}
      <div className="relative z-10 min-h-screen flex flex-col pointer-events-none">
        
        {/* Header */}
        <header className="pt-6 pb-4 px-6 text-center pointer-events-auto">
          <h1 className="text-4xl md:text-6xl font-extralight text-white mb-1 tracking-widest drop-shadow-lg">
            Sacred Breath
          </h1>
          <p className="text-xs md:text-sm text-purple-200/60 tracking-[0.3em] uppercase">
            Pranayama Practice
          </p>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-4">
          
          {/* Central Timer Display */}
          <div className="relative mb-6 pointer-events-auto">
            {/* Progress Ring SVG */}
            <svg className="w-56 h-56 md:w-72 md:h-72 transform -rotate-90" viewBox="0 0 100 100">
              {/* Background ring */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-white/10"
              />
              {/* Progress arc */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - breath.phaseProgress)}`}
                className={phaseInfo.color}
                style={{
                  filter: 'drop-shadow(0 0 10px currentColor)',
                  transition: 'stroke-dashoffset 0.05s linear'
                }}
              />
            </svg>

            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {/* Countdown */}
              <div className="text-6xl md:text-8xl font-thin text-white tabular-nums tracking-tighter drop-shadow-2xl">
                {breath.countdown}
              </div>
              
              {/* Phase label */}
              <div className={`text-lg md:text-xl font-medium ${phaseInfo.color} tracking-[0.2em] uppercase mt-1`}>
                {phaseInfo.label}
              </div>
            </div>
          </div>

          {/* Phase instruction */}
          <p className="text-base md:text-lg text-white/70 text-center max-w-md mb-6 font-light tracking-wide">
            {phaseInfo.instruction}
          </p>

          {/* Stats Row */}
          <div className="flex gap-8 mb-6 pointer-events-auto">
            <div className="text-center">
              <div className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Cycle</div>
              <div className="text-xl font-light text-white">{breath.cycle}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Phase</div>
              <div className="text-xl font-light text-white">{Math.round(breath.phaseProgress * 100)}%</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Chakra</div>
              <div className={`text-xl font-light ${phaseInfo.color}`}>
                {['Root', 'Sacral', 'Solar', 'Heart', 'Throat', 'Third Eye', 'Crown'][PHASE_CHAKRAS[breath.phase]]}
              </div>
            </div>
          </div>

          {/* Posture Guide */}
          {showPosture && (
            <div className="w-full max-w-xs mb-6 pointer-events-auto">
              <PostureGuide phase={breath.phase} />
            </div>
          )}

          {/* Phase Dots Indicator */}
          <div className="flex gap-4 mb-8">
            {(['inhale', 'hold1', 'exhale', 'hold2'] as Phase[]).map((phase, idx) => {
              const isActive = breath.phase === phase;
              const colors = ['bg-cyan-400', 'bg-yellow-400', 'bg-orange-400', 'bg-emerald-400'];
              return (
                <div
                  key={phase}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${colors[idx]} ${
                    isActive ? 'scale-150 shadow-lg shadow-current' : 'opacity-20'
                  }`}
                />
              );
            })}
          </div>
        </main>

        {/* Bottom Controls Panel */}
        <div className="bg-black/60 backdrop-blur-2xl border-t border-white/5 px-6 py-5 pointer-events-auto">
          <div className="max-w-4xl mx-auto">
            
            {/* Strength Level Selector */}
            <div className="flex justify-center gap-2 mb-5">
              {[0, 1, 2].map((level) => (
                <button
                  key={level}
                  onClick={() => handleStrengthChange(level)}
                  disabled={breath.isRunning}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition-all duration-300 ${
                    selectedStrength === level
                      ? 'bg-white/20 text-white shadow-lg shadow-white/10'
                      : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80'
                  } ${breath.isRunning ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  {strengthLabels[level]}
                </button>
              ))}
            </div>
            
            {/* Control Buttons */}
            <div className="flex justify-center gap-3 mb-5">
              <button
                onClick={breath.isRunning ? breath.pause : breath.start}
                className={`px-8 py-3 rounded-full font-medium text-sm transition-all duration-300 ${
                  breath.isRunning
                    ? 'bg-amber-500/90 hover:bg-amber-500 text-white shadow-lg shadow-amber-500/25'
                    : 'bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white shadow-lg shadow-purple-500/25'
                }`}
              >
                {breath.isRunning ? 'Pause' : 'Start Practice'}
              </button>
              <button
                onClick={breath.reset}
                className="px-6 py-3 rounded-full font-medium text-sm bg-white/10 hover:bg-white/20 text-white/80 transition-all duration-300"
              >
                Reset
              </button>
              <button
                onClick={() => setShowPosture(!showPosture)}
                className={`px-4 py-3 rounded-full font-medium text-sm transition-all duration-300 ${
                  showPosture 
                    ? 'bg-purple-500/50 text-purple-100' 
                    : 'bg-white/10 text-white/50 hover:bg-white/15'
                }`}
                title="Toggle posture guide"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>
            </div>

            {/* Phase Duration Controls - simplified */}
            <div className="text-center text-[10px] text-white/30">
              <p>Strength: {strengthLabels[selectedStrength]} ({selectedStrength === 0 ? '4-4-6-2' : selectedStrength === 1 ? '5-5-7-3' : '6-6-8-4'})</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="fixed bottom-2 right-4 z-20 pointer-events-none">
        <p className="text-[9px] text-white/20 tracking-wider">
          Sacred Breath • WebGPU
        </p>
      </footer>
    </div>
  );
}
