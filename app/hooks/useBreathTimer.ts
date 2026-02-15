'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export type StrengthLevel = 'light' | 'medium' | 'strong';

export type BreathPhase = 'inhale' | 'hold-in' | 'exhale' | 'hold-out';

// Chakras associated with each breath phase
export type ChakraName = 
  | 'Muladhara'      // Root - red
  | 'Svadhisthana'   // Sacral - orange  
  | 'Manipura'       // Solar Plexus - yellow
  | 'Anahata'        // Heart - green
  | 'Vishuddha'      // Throat - cyan/blue
  | 'Ajna'           // Third Eye - indigo
  | 'Sahasrara';     // Crown - violet

interface ChakraInfo {
  name: ChakraName;
  sanskrit: string;
  color: string;      // hex color
  location: string;
  element: string;
  significance: string;
}

export const CHAKRAS: Record<ChakraName, ChakraInfo> = {
  'Muladhara': {
    name: 'Muladhara',
    sanskrit: 'मूलाधार',
    color: '#ef4444',
    location: 'Base of spine',
    element: 'Earth',
    significance: 'Grounding, stability, survival',
  },
  'Svadhisthana': {
    name: 'Svadhisthana',
    sanskrit: 'स्वाधिष्ठान',
    color: '#f97316',
    location: 'Lower abdomen',
    element: 'Water',
    significance: 'Creativity, emotions, flow',
  },
  'Manipura': {
    name: 'Manipura',
    sanskrit: 'मणिपूर',
    color: '#eab308',
    location: 'Solar plexus',
    element: 'Fire',
    significance: 'Power, will, transformation',
  },
  'Anahata': {
    name: 'Anahata',
    sanskrit: 'अनाहत',
    color: '#22c55e',
    location: 'Heart center',
    element: 'Air',
    significance: 'Love, compassion, connection',
  },
  'Vishuddha': {
    name: 'Vishuddha',
    sanskrit: 'विशुद्ध',
    color: '#06b6d4',
    location: 'Throat',
    element: 'Ether',
    significance: 'Communication, truth, expression',
  },
  'Ajna': {
    name: 'Ajna',
    sanskrit: 'आज्ञा',
    color: '#6366f1',
    location: 'Between eyebrows',
    element: 'Light',
    significance: 'Intuition, wisdom, perception',
  },
  'Sahasrara': {
    name: 'Sahasrara',
    sanskrit: 'सहस्रार',
    color: '#a855f7',
    location: 'Crown of head',
    element: 'Cosmic',
    significance: 'Consciousness, unity, liberation',
  },
};

// Primary and secondary chakras for each breath phase
export const PHASE_CHAKRAS: Record<BreathPhase, { primary: ChakraName; secondary?: ChakraName; significance: string }> = {
  'inhale': {
    primary: 'Anahata',
    secondary: 'Vishuddha',
    significance: 'Opening the heart, receiving prana',
  },
  'hold-in': {
    primary: 'Manipura',
    significance: 'Building internal fire, charging solar plexus',
  },
  'exhale': {
    primary: 'Muladhara',
    significance: 'Grounding, releasing into earth element',
  },
  'hold-out': {
    primary: 'Sahasrara',
    significance: 'Open to cosmic consciousness, shunya (void)',
  },
};

export interface BreathState {
  /** Current strength level */
  strengthLevel: StrengthLevel;
  /** Current breath phase */
  phase: BreathPhase;
  /** Current cycle number (0-based) */
  cycle: number;
  /** Progress through current breath (0-1) */
  progress: number;
  /** Time remaining in current phase (seconds) */
  timeRemaining: number;
  /** Total duration of current phase (seconds) */
  phaseDuration: number;
  /** Whether the timer is running */
  isRunning: boolean;
  /** Total elapsed time since start */
  elapsedTime: number;
  /** Primary active chakra for current phase */
  activeChakra: ChakraName;
  /** Secondary chakra (if applicable) */
  secondaryChakra?: ChakraName;
}

interface BreathTimerConfig {
  strengthLevel: StrengthLevel;
  autoStart?: boolean;
}

const STRENGTH_CONFIGS: Record<StrengthLevel, { initial: number; threshold1: number; value1: number; threshold2?: number; value2?: number }> = {
  light: { initial: 5, threshold1: 16, value1: 7 },
  medium: { initial: 7, threshold1: 31, value1: 8 },
  strong: { initial: 7, threshold1: 31, value1: 8, threshold2: 61, value2: 10 },
};

function getBreathDuration(cycle: number, strengthLevel: StrengthLevel): number {
  const config = STRENGTH_CONFIGS[strengthLevel];
  
  if (strengthLevel === 'light') {
    return cycle > config.threshold1 ? config.value1 : config.initial;
  } else if (strengthLevel === 'medium') {
    return cycle > config.threshold1 ? config.value1 : config.initial;
  } else {
    // strong
    if (cycle > (config.threshold2 ?? 61)) {
      return config.value2 ?? 10;
    } else if (cycle > config.threshold1) {
      return config.value1;
    }
    return config.initial;
  }
}

function getPhaseFromProgress(progress: number): BreathPhase {
  // 4 phases, each 25% of the breath cycle
  if (progress < 0.25) return 'inhale';
  if (progress < 0.5) return 'hold-in';
  if (progress < 0.75) return 'exhale';
  return 'hold-out';
}

function getPhaseProgress(progress: number): { phase: BreathPhase; phaseProgress: number } {
  const phase = getPhaseFromProgress(progress);
  let phaseProgress: number;
  
  switch (phase) {
    case 'inhale':
      phaseProgress = progress / 0.25;
      break;
    case 'hold-in':
      phaseProgress = (progress - 0.25) / 0.25;
      break;
    case 'exhale':
      phaseProgress = (progress - 0.5) / 0.25;
      break;
    case 'hold-out':
      phaseProgress = (progress - 0.75) / 0.25;
      break;
  }
  
  return { phase, phaseProgress };
}

export function useBreathTimer(config: BreathTimerConfig): {
  state: BreathState;
  actions: {
    start: () => void;
    pause: () => void;
    reset: () => void;
    setStrengthLevel: (level: StrengthLevel) => void;
  };
} {
  const { strengthLevel: initialStrength, autoStart = true } = config;
  
  const [strengthLevel, setStrengthLevelState] = useState<StrengthLevel>(initialStrength);
  const [isRunning, setIsRunning] = useState(autoStart);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const startTimeRef = useRef<number | null>(null);
  const pausedTimeRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  
  // Calculate current breath state based on elapsed time
  const calculateState = useCallback((): Omit<BreathState, 'strengthLevel' | 'isRunning' | 'elapsedTime'> => {
    let remainingTime = elapsedTime;
    let cycle = 0;
    let breathDuration = getBreathDuration(cycle, strengthLevel);
    
    // Find which cycle we're in
    while (remainingTime >= breathDuration) {
      remainingTime -= breathDuration;
      cycle++;
      breathDuration = getBreathDuration(cycle, strengthLevel);
      
      // Safety check for very long sessions
      if (cycle > 10000) break;
    }
    
    const progress = remainingTime / breathDuration;
    const { phase, phaseProgress } = getPhaseProgress(progress);
    const timeRemaining = breathDuration * (1 - phaseProgress) * 0.25;
    const chakraInfo = PHASE_CHAKRAS[phase];
    
    return {
      phase,
      cycle,
      progress,
      timeRemaining,
      phaseDuration: breathDuration * 0.25,
      activeChakra: chakraInfo.primary,
      secondaryChakra: chakraInfo.secondary,
    };
  }, [elapsedTime, strengthLevel]);
  
  // Animation loop
  useEffect(() => {
    if (!isRunning) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }
    
    const tick = () => {
      const now = performance.now();
      
      if (startTimeRef.current === null) {
        startTimeRef.current = now - pausedTimeRef.current;
      }
      
      const newElapsedTime = (now - startTimeRef.current) / 1000;
      setElapsedTime(newElapsedTime);
      
      animationFrameRef.current = requestAnimationFrame(tick);
    };
    
    animationFrameRef.current = requestAnimationFrame(tick);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRunning]);
  
  const start = useCallback(() => {
    if (!isRunning) {
      startTimeRef.current = null;
      setIsRunning(true);
    }
  }, [isRunning]);
  
  const pause = useCallback(() => {
    if (isRunning) {
      pausedTimeRef.current = elapsedTime * 1000;
      startTimeRef.current = null;
      setIsRunning(false);
    }
  }, [isRunning, elapsedTime]);
  
  const reset = useCallback(() => {
    pausedTimeRef.current = 0;
    startTimeRef.current = null;
    setElapsedTime(0);
  }, []);
  
  const setStrengthLevel = useCallback((level: StrengthLevel) => {
    setStrengthLevelState(level);
  }, []);
  
  const calculatedState = calculateState();
  
  const state: BreathState = {
    ...calculatedState,
    strengthLevel,
    isRunning,
    elapsedTime,
  };
  
  return {
    state,
    actions: {
      start,
      pause,
      reset,
      setStrengthLevel,
    },
  };
}

export default useBreathTimer;
