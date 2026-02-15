'use client';

import { BreathState, StrengthLevel, BreathPhase, CHAKRAS, PHASE_CHAKRAS } from '../hooks/useBreathTimer';

interface BreathTimerProps {
  state: BreathState;
  onStrengthChange?: (level: StrengthLevel) => void;
  onTogglePause?: () => void;
  onReset?: () => void;
}

const PHASE_LABELS: Record<BreathPhase, { label: string; sublabel: string; color: string }> = {
  'inhale': { label: 'Breathe In', sublabel: 'Inhale deeply through your nose', color: 'from-cyan-400 to-blue-500' },
  'hold-in': { label: 'Hold', sublabel: 'Keep the breath in', color: 'from-yellow-400 to-amber-500' },
  'exhale': { label: 'Breathe Out', sublabel: 'Exhale slowly through your mouth', color: 'from-purple-400 to-pink-500' },
  'hold-out': { label: 'Hold', sublabel: 'Empty lungs, stay relaxed', color: 'from-emerald-400 to-teal-500' },
};

const STRENGTH_LABELS: Record<StrengthLevel, { label: string; description: string; color: string }> = {
  'light': { label: 'Light', description: '5-7s breaths', color: 'bg-emerald-500' },
  'medium': { label: 'Medium', description: '7-8s breaths', color: 'bg-amber-500' },
  'strong': { label: 'Strong', description: '7-10s breaths', color: 'bg-rose-500' },
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

export default function BreathTimer({ 
  state, 
  onStrengthChange, 
  onTogglePause, 
  onReset 
}: BreathTimerProps) {
  const { label, sublabel, color } = PHASE_LABELS[state.phase];
  const progressPercent = Math.round(state.progress * 100);
  
  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Main Phase Display */}
      <div className="relative">
        {/* Phase Circle Progress */}
        <div className="relative w-48 h-48 mx-auto">
          {/* Background ring */}
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="4"
            />
            {/* Progress ring */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="url(#gradient)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${progressPercent * 2.83} 283`}
              className="transition-all duration-100 ease-linear"
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          </svg>
          
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-xs text-purple-300 uppercase tracking-widest mb-1">
              Phase
            </span>
            <span className={`text-2xl font-bold bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
              {label}
            </span>
            <span className="text-xs text-purple-200 mt-1">
              Cycle {state.cycle + 1}
            </span>
          </div>
        </div>
        
        {/* Phase Sublabel */}
        <p className="text-center text-purple-200 text-sm mt-4">
          {sublabel}
        </p>
      </div>
      
      {/* Timer Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
          <div className="text-xs text-purple-300 uppercase tracking-wide">Remaining</div>
          <div className="text-xl font-semibold text-white">
            {state.timeRemaining.toFixed(1)}s
          </div>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
          <div className="text-xs text-purple-300 uppercase tracking-wide">Phase Time</div>
          <div className="text-xl font-semibold text-white">
            {state.phaseDuration.toFixed(1)}s
          </div>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
          <div className="text-xs text-purple-300 uppercase tracking-wide">Session</div>
          <div className="text-xl font-semibold text-white">
            {formatTime(state.elapsedTime)}
          </div>
        </div>
      </div>
      
      {/* Active Chakra Section */}
      <div className="bg-black/20 backdrop-blur-sm rounded-xl p-4 border border-white/5">
        <div className="flex items-center gap-3 mb-3">
          <div 
            className="w-4 h-4 rounded-full shadow-lg"
            style={{ 
              backgroundColor: CHAKRAS[state.activeChakra].color,
              boxShadow: `0 0 12px ${CHAKRAS[state.activeChakra].color}` 
            }}
          />
          <div>
            <h4 className="text-sm font-medium text-white">
              {CHAKRAS[state.activeChakra].name} 
              <span className="text-white/50 text-xs ml-1">{CHAKRAS[state.activeChakra].sanskrit}</span>
            </h4>
            <p className="text-xs text-white/50">{CHAKRAS[state.activeChakra].location}</p>
          </div>
        </div>
        <p className="text-xs text-white/70 mb-2">
          {PHASE_CHAKRAS[state.phase].significance}
        </p>
        {state.secondaryChakra && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-white/40">Secondary:</span>
            <span 
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: CHAKRAS[state.secondaryChakra].color }}
            />
            <span className="text-white/60">{CHAKRAS[state.secondaryChakra].name}</span>
          </div>
        )}
      </div>
      
      {/* Strength Level Selector */}
      <div className="space-y-2">
        <label className="text-xs text-purple-300 uppercase tracking-wide block">
          Breath Intensity
        </label>
        <div className="flex gap-2">
          {(Object.keys(STRENGTH_LABELS) as StrengthLevel[]).map((level) => {
            const { label: strengthLabel, color: strengthColor } = STRENGTH_LABELS[level];
            const isActive = state.strengthLevel === level;
            
            return (
              <button
                key={level}
                onClick={() => onStrengthChange?.(level)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive 
                    ? `${strengthColor} text-white shadow-lg` 
                    : 'bg-white/10 text-purple-200 hover:bg-white/20'
                }`}
              >
                {strengthLabel}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-purple-400">
          {STRENGTH_LABELS[state.strengthLevel].description}
        </p>
      </div>
      
      {/* Control Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onTogglePause}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
            state.isRunning
              ? 'bg-amber-500/80 hover:bg-amber-500 text-white'
              : 'bg-emerald-500/80 hover:bg-emerald-500 text-white'
          }`}
        >
          {state.isRunning ? 'Pause' : 'Resume'}
        </button>
        <button
          onClick={onReset}
          className="px-4 py-3 rounded-lg font-medium bg-white/10 hover:bg-white/20 text-purple-200 transition-all duration-200"
        >
          Reset
        </button>
      </div>
      
      {/* Cycle Progress Indicator */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-purple-300">
          <span>Cycle Progress</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 transition-all duration-100 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        
        {/* Phase indicators */}
        <div className="flex justify-between pt-1">
          {(['inhale', 'hold-in', 'exhale', 'hold-out'] as BreathPhase[]).map((phase) => (
            <div 
              key={phase}
              className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                state.phase === phase ? 'bg-white shadow-lg shadow-white/50' : 'bg-white/20'
              }`}
              title={PHASE_LABELS[phase].label}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
