'use client';

import { BreathPhase } from '../hooks/useBreathTimer';

interface PostureGuideProps {
  phase: BreathPhase;
  showDetails?: boolean;
}

interface PoseInfo {
  name: string;
  sanskrit: string;
  description: string;
  bandha: string;
  drishti: string;
  chakra: string;
  instruction: string;
}

const POSE_INFO: Record<BreathPhase, PoseInfo> = {
  'inhale': {
    name: 'Raising Arms',
    sanskrit: 'Urdhva Hastasana',
    description: 'Inhale deeply through the nose, lifting arms overhead',
    bandha: 'Mula Bandha gently engaged',
    drishti: 'Soft gaze upward or eyes closed',
    chakra: 'Anahata (Heart) - Vishuddha (Throat)',
    instruction: 'Palms face each other or touch. Expand the chest.',
  },
  'hold-in': {
    name: 'Hold with Flex',
    sanskrit: 'Antara Kumbhaka',
    description: 'Retain the breath, arms extended, subtle muscular engagement',
    bandha: 'Mula Bandha & Uddiyana Bandha engaged',
    drishti: 'Fixed point or third eye (Ajna)',
    chakra: 'Manipura (Solar Plexus) - charged',
    instruction: 'Feel energy rising through sushumna nadi. Stay soft in the face.',
  },
  'exhale': {
    name: 'Lowering Arms',
    sanskrit: 'Hasta Uttanasana Release',
    description: 'Exhale slowly through nose or mouth, lowering arms gracefully',
    bandha: 'Release bandhas gradually',
    drishti: 'Follow hands down or close eyes',
    chakra: 'Muladhara (Root) - grounding',
    instruction: 'Palms may come to heart center or rest at sides. Surrender.',
  },
  'hold-out': {
    name: 'Empty Hold',
    sanskrit: 'Bahya Kumbhaka',
    description: 'Pause with empty lungs, complete relaxation',
    bandha: 'All bandhas released, complete softness',
    drishti: 'Closed eyes or soft downward gaze',
    chakra: 'Sahasrara (Crown) - open to receive',
    instruction: 'Experience shunya (void). Let prana circulate freely.',
  },
};

// SVG Stick figure component with phase-specific poses
function StickFigure({ phase }: { phase: BreathPhase }) {
  const getArmPaths = () => {
    switch (phase) {
      case 'inhale':
        // Arms rising overhead
        return (
          <>
            {/* Left arm rising */}
            <path
              d="M 50 35 Q 30 20 35 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="text-cyan-400"
            >
              <animate
                attributeName="d"
                values="M 50 35 Q 30 20 35 10;M 50 35 Q 25 15 30 5;M 50 35 Q 30 20 35 10"
                dur="3s"
                repeatCount="indefinite"
              />
            </path>
            {/* Right arm rising */}
            <path
              d="M 50 35 Q 70 20 65 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="text-cyan-400"
            >
              <animate
                attributeName="d"
                values="M 50 35 Q 70 20 65 10;M 50 35 Q 75 15 70 5;M 50 35 Q 70 20 65 10"
                dur="3s"
                repeatCount="indefinite"
              />
            </path>
            {/* Hands */}
            <circle cx="35" cy="10" r="3" className="fill-cyan-400" />
            <circle cx="65" cy="10" r="3" className="fill-cyan-400" />
          </>
        );
      case 'hold-in':
        // Arms overhead with slight flex/tension
        return (
          <>
            {/* Left arm overhead with tension */}
            <path
              d="M 50 35 L 25 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="text-yellow-400"
            />
            {/* Right arm overhead with tension */}
            <path
              d="M 50 35 L 75 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="text-yellow-400"
            />
            {/* Hands with energy lines */}
            <circle cx="25" cy="8" r="3" className="fill-yellow-400">
              <animate
                attributeName="r"
                values="3;4;3"
                dur="1s"
                repeatCount="indefinite"
              />
            </circle>
            <circle cx="75" cy="8" r="3" className="fill-yellow-400">
              <animate
                attributeName="r"
                values="3;4;3"
                dur="1s"
                repeatCount="indefinite"
              />
            </circle>
            {/* Core tension indicator */}
            <ellipse cx="50" cy="50" rx="8" ry="5" className="fill-yellow-400/20" />
          </>
        );
      case 'exhale':
        // Arms lowering
        return (
          <>
            {/* Left arm lowering */}
            <path
              d="M 50 35 Q 35 45 30 55"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="text-purple-400"
            >
              <animate
                attributeName="d"
                values="M 50 35 Q 35 45 30 55;M 50 35 Q 35 50 25 60;M 50 35 Q 35 45 30 55"
                dur="3s"
                repeatCount="indefinite"
              />
            </path>
            {/* Right arm lowering */}
            <path
              d="M 50 35 Q 65 45 70 55"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="text-purple-400"
            >
              <animate
                attributeName="d"
                values="M 50 35 Q 65 45 70 55;M 50 35 Q 65 50 75 60;M 50 35 Q 65 45 70 55"
                dur="3s"
                repeatCount="indefinite"
              />
            </path>
            {/* Hands */}
            <circle cx="30" cy="55" r="3" className="fill-purple-400" />
            <circle cx="70" cy="55" r="3" className="fill-purple-400" />
          </>
        );
      case 'hold-out':
        // Arms at sides, relaxed
        return (
          <>
            {/* Left arm relaxed */}
            <path
              d="M 50 35 Q 40 45 35 58"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="text-emerald-400"
            />
            {/* Right arm relaxed */}
            <path
              d="M 50 35 Q 60 45 65 58"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="text-emerald-400"
            />
            {/* Hands */}
            <circle cx="35" cy="58" r="3" className="fill-emerald-400" />
            <circle cx="65" cy="58" r="3" className="fill-emerald-400" />
            {/* Soft glow for relaxation */}
            <circle cx="50" cy="30" r="20" className="fill-emerald-400/10" />
          </>
        );
    }
  };

  return (
    <svg
      viewBox="0 0 100 100"
      className="w-full h-full"
      style={{ maxHeight: '200px' }}
    >
      {/* Ground line */}
      <line x1="10" y1="90" x2="90" y2="90" stroke="currentColor" strokeWidth="1" className="text-white/20" />
      
      {/* Legs - standing position */}
      <path
        d="M 50 60 L 40 90"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="text-white/60"
      />
      <path
        d="M 50 60 L 60 90"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="text-white/60"
      />
      
      {/* Torso */}
      <line
        x1="50"
        y1="60"
        x2="50"
        y2="35"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="text-white/60"
      />
      
      {/* Head */}
      <circle
        cx="50"
        cy="25"
        r="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-white/60"
      />
      
      {/* Arms - phase specific */}
      {getArmPaths()}
      
      {/* Chakra indicators */}
      <g className="opacity-50">
        {/* Root - Muladhara */}
        <circle cx="50" cy="75" r="2" className="fill-red-500" />
        {/* Sacral - Svadhisthana */}
        <circle cx="50" cy="65" r="2" className="fill-orange-500" />
        {/* Solar Plexus - Manipura */}
        <circle cx="50" cy="55" r="2" className="fill-yellow-500" />
        {/* Heart - Anahata */}
        <circle cx="50" cy="45" r="2" className="fill-green-500" />
        {/* Throat - Vishuddha */}
        <circle cx="50" cy="38" r="2" className="fill-cyan-500" />
        {/* Third Eye - Ajna */}
        <circle cx="50" cy="25" r="2" className="fill-indigo-500" />
        {/* Crown - Sahasrara */}
        <circle cx="50" cy="15" r="2" className="fill-violet-500" />
      </g>
      
      {/* Active chakra glow based on phase */}
      {phase === 'inhale' && (
        <circle cx="50" cy="45" r="4" className="fill-green-400/50">
          <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0.8;0.5" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
      {phase === 'hold-in' && (
        <circle cx="50" cy="55" r="4" className="fill-yellow-400/50">
          <animate attributeName="r" values="4;6;4" dur="1s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0.8;0.5" dur="1s" repeatCount="indefinite" />
        </circle>
      )}
      {phase === 'exhale' && (
        <circle cx="50" cy="75" r="4" className="fill-red-400/50">
          <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0.8;0.5" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
      {phase === 'hold-out' && (
        <circle cx="50" cy="15" r="4" className="fill-violet-400/50">
          <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0.8;0.5" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
}

export default function PostureGuide({ phase, showDetails = true }: PostureGuideProps) {
  const info = POSE_INFO[phase];
  
  const phaseColors = {
    'inhale': 'border-cyan-500/30 bg-cyan-950/20',
    'hold-in': 'border-yellow-500/30 bg-yellow-950/20',
    'exhale': 'border-purple-500/30 bg-purple-950/20',
    'hold-out': 'border-emerald-500/30 bg-emerald-950/20',
  };
  
  const phaseGradient = {
    'inhale': 'from-cyan-500/20 to-blue-500/20',
    'hold-in': 'from-yellow-500/20 to-amber-500/20',
    'exhale': 'from-purple-500/20 to-pink-500/20',
    'hold-out': 'from-emerald-500/20 to-teal-500/20',
  };

  return (
    <div className={`rounded-2xl border ${phaseColors[phase]} overflow-hidden`}>
      {/* Header */}
      <div className={`bg-gradient-to-r ${phaseGradient[phase]} px-4 py-3 border-b border-white/10`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">{info.name}</h3>
            <p className="text-xs text-white/60 italic">{info.sanskrit}</p>
          </div>
          <div className="text-right">
            <span className="text-xs uppercase tracking-wider text-white/40">Phase</span>
            <p className="text-sm font-medium text-white capitalize">{phase.replace('-', ' ')}</p>
          </div>
        </div>
      </div>
      
      {/* Stick Figure Visualization */}
      <div className="p-4 flex justify-center">
        <div className="w-32 h-40">
          <StickFigure phase={phase} />
        </div>
      </div>
      
      {/* Detailed Instructions */}
      {showDetails && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-sm text-white/80">{info.description}</p>
          
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-black/20 rounded p-2">
              <span className="text-white/40 uppercase tracking-wider block mb-1">Bandha</span>
              <span className="text-white/70">{info.bandha}</span>
            </div>
            <div className="bg-black/20 rounded p-2">
              <span className="text-white/40 uppercase tracking-wider block mb-1">Drishti</span>
              <span className="text-white/70">{info.drishti}</span>
            </div>
          </div>
          
          <div className="bg-black/20 rounded p-2">
            <span className="text-white/40 uppercase tracking-wider text-xs block mb-1">Active Chakra</span>
            <span className="text-white/70 text-sm">{info.chakra}</span>
          </div>
          
          <div className="bg-white/5 rounded p-2 border-l-2 border-white/20">
            <p className="text-xs text-white/60 italic">{info.instruction}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Export pose info for use in other components
export { POSE_INFO };
export type { PoseInfo };
