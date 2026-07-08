import type { SessionMode } from '../types/sessionMode';
import { TECHNIQUES } from './techniques';

export const ONBOARDING_STORAGE_KEY = 'sacred-breath-onboarding';

/** Gentle box-breath mode — equal 4-phase timing, classic visuals at light intensity */
export const BEGINNER_MODE_ID = 'classic-mandala';

export const BEGINNER_SESSION_MINUTES = 5 as const;

export const getBeginnerMode = (): SessionMode => {
  const mode = TECHNIQUES.find((m) => m.id === BEGINNER_MODE_ID);
  if (!mode) return TECHNIQUES[0];
  return {
    ...mode,
    strengthLevel: 0.5,
    geometryDensity: 0.7,
    interference: 0.25,
    qualityPreset: 0,
    maxDevicePixelRatio: 1.25,
  };
};

export const BEGINNER_MUSCLE_CUES: Record<string, string> = {
  inhale: 'Breathe in slowly through your nose',
  hold1: 'Hold gently — stay soft and relaxed',
  exhale: 'Release the breath, unhurried',
  hold2: 'Rest in stillness before the next round',
};

export const WELCOME_COPY = {
  title: 'Sacred Breath Timer',
  subtitle: 'Science-informed pranayama, synchronized with energy and posture',
  body: 'Rooted in traditional techniques with measurable benefits for the nervous system, focus, and energetic balance. Follow the ring, the countdown, and gentle cues — no experience needed.',
};

export const SCIENCE_BENEFITS = [
  {
    title: 'Autonomic balance',
    body: 'Equal-length inhale, hold, and exhale (box breathing) helps shift the nervous system from stress reactivity toward calm alertness — supporting heart-rate variability and vagal tone.',
  },
  {
    title: 'Focused attention',
    body: 'Timed phases give your mind a simple anchor. Research on slow, structured breathing shows improved attention and reduced mind-wandering within minutes.',
  },
  {
    title: 'Energetic awareness',
    body: 'Chakra-aligned visuals are not decoration — they give you a focal point for where breath and attention meet, deepening interoceptive awareness.',
  },
];

export const FIRST_SESSION_BENEFIT =
  'Structured slow breathing can lower sympathetic arousal within a single session — many people report feeling calmer and more centered after just five minutes.';

export const NEXT_STEP_BY_MODE: Record<string, { modeId: string; label: string; reason: string }> = {
  [BEGINNER_MODE_ID]: {
    modeId: 'lotus-heart',
    label: 'Heart Coherence',
    reason: 'A heart-centered variation with gentle equal breathing — a natural next step after box breath.',
  },
  'lotus-heart': {
    modeId: 'deep-release',
    label: 'Deep Release',
    reason: 'Try the 4-7-8 pattern when you want deeper nervous-system downshift.',
  },
  'nadi-shodhana': {
    modeId: 'ujjayi',
    label: 'Ujjayi',
    reason: 'Layer victorious ocean breath after establishing channel balance.',
  },
};

export const DEFAULT_NEXT_STEP = NEXT_STEP_BY_MODE[BEGINNER_MODE_ID];

export interface TourStep {
  id: string;
  title: string;
  body: string;
  target: 'phase' | 'countdown' | 'ring' | 'controls' | 'modes';
}

export const INTRO_TOUR_STEPS: TourStep[] = [
  {
    id: 'phases',
    target: 'phase',
    title: 'Four phases',
    body: 'Each round moves through inhale → hold → exhale → rest. The large label shows where you are now.',
  },
  {
    id: 'countdown',
    target: 'countdown',
    title: 'Countdown',
    body: 'The number counts down seconds left in this phase. Let it guide you — no need to watch the clock.',
  },
  {
    id: 'ring',
    target: 'ring',
    title: 'Breath ring',
    body: 'The ring completes one full turn per breath cycle. It mirrors your rhythm so you can breathe with your eyes soft.',
  },
  {
    id: 'visuals',
    target: 'controls',
    title: 'Visual support',
    body: 'Colors and mandala motion respond to your breath. They are cues for awareness, not distractions.',
  },
  {
    id: 'science',
    target: 'modes',
    title: 'Why equal timing matters',
    body: 'Balanced phase lengths train steady CO₂ tolerance and autonomic balance — the foundation of calm, focused pranayama.',
  },
];
