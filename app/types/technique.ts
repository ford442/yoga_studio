import type { BreathPhase } from '../hooks/useBreathTimer';

export type PracticeGoal = 'calm' | 'focus' | 'energize' | 'deep';

export type TechniqueDifficulty = 'gentle' | 'moderate' | 'advanced';

export interface TechniqueMeta {
  sanskritName: string;
  commonName: string;
  tagline: string;
  /** One-line researched benefit for cards and selection banner */
  scienceBenefit: string;
  /** Expandable neutral science summary — sacred tone, not clinical */
  scienceDetail: string;
  goals: PracticeGoal[];
  difficulty: TechniqueDifficulty;
  recommendedMinutes: readonly (5 | 10 | 15)[];
  postureFocus: string;
  bandhaFocus?: string;
  drishtiCue?: string;
  phaseCues: Record<BreathPhase, string>;
  tradition: string;
  beginnerFriendly: boolean;
}

export const PRACTICE_GOALS: Array<{ id: PracticeGoal | 'all'; label: string; emoji: string }> = [
  { id: 'all', label: 'All', emoji: '✦' },
  { id: 'calm', label: 'Calm', emoji: '🌙' },
  { id: 'focus', label: 'Focus', emoji: '🎯' },
  { id: 'energize', label: 'Energize', emoji: '⚡' },
  { id: 'deep', label: 'Deep Practice', emoji: '🕉️' },
];

export const DIFFICULTY_LABELS: Record<TechniqueDifficulty, string> = {
  gentle: 'Gentle',
  moderate: 'Moderate',
  advanced: 'Advanced',
};
