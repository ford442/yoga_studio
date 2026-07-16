import type { Program, ProgramDay, ProgramSessionDay, ActiveProgramProgress } from '../types/program';
import type { SessionMode } from '../types/sessionMode';

const session = (
  dayIndex: number,
  techniqueId: string,
  durationMinutes: 5 | 10 | 15 | 'free',
  goal?: string,
  note?: string,
): ProgramSessionDay => ({
  type: 'session',
  dayIndex,
  techniqueId,
  durationMinutes,
  goal,
  note,
});

const rest = (dayIndex: number, note?: string): ProgramDay => ({
  type: 'rest',
  dayIndex,
  note,
});

export const PROGRAMS: Program[] = [
  {
    id: 'beginner-calm-week',
    label: 'Beginner Calm Week',
    emoji: '🌱',
    description:
      'A gentle seven-day introduction to paced breathing. Alternates equal rhythm, heart coherence, and grounding with a rest day in the middle.',
    goals: ['calm'],
    difficulty: 'gentle',
    durationDays: 7,
    days: [
      session(0, 'classic-mandala', 5, 'Establish steady box breath.', 'Start with 5 minutes of equal inhale, hold, exhale, and rest.'),
      session(1, 'lotus-heart', 5, 'Open the chest and soften the heart.', 'Equal five-count phases to build coherence.'),
      session(2, 'grounding', 5, 'Settle into the body and earth.', 'Long exhale and empty hold root the nervous system.'),
      rest(3, 'A full rest day. Notice how calm feels in ordinary moments.'),
      session(4, 'classic-mandala', 10, 'Return to equal rhythm with more presence.', 'Ten minutes of box breathing for steadiness.'),
      session(5, 'lotus-heart', 10, 'Deepen heart-centered coherence.', 'Stay with the five-count equal wave.'),
      session(6, 'grounding', 10, 'Ground the week\'s practice.', 'Finish with a longer grounding session.'),
    ],
  },
  {
    id: 'focus-reset',
    label: 'Focus Reset',
    emoji: '🎯',
    description:
      'Five days of channel-balancing and alert-calm techniques designed to reset attention and steady the mind.',
    goals: ['focus', 'calm'],
    difficulty: 'moderate',
    durationDays: 5,
    days: [
      session(0, 'classic-mandala', 5, 'Stabilize attention with equal rhythm.', 'Box breathing primes focused awareness.'),
      session(1, 'nadi-shodhana', 10, 'Balance the channels.', 'Alternate-nostril timing without the hand gesture.'),
      session(2, 'prana-flow', 10, 'Invite creative momentum.', 'Asymmetric breath with visual movement cues.'),
      session(3, 'classic-mandala', 10, 'Return to steady equal rhythm.', 'Re-anchor attention after the dynamic day.'),
      session(4, 'nadi-shodhana', 10, 'Seal the reset with channel balance.', 'Close the week with calm, balanced focus.'),
    ],
  },
  {
    id: 'deep-evening-practice',
    label: 'Deep Evening Practice',
    emoji: '🌙',
    description:
      'Five evenings of down-regulating breathwork to unwind the nervous system and prepare for rest.',
    goals: ['deep', 'calm'],
    difficulty: 'moderate',
    durationDays: 5,
    days: [
      session(0, 'deep-release', 5, 'Dissolve tension with 4-7-8.', 'A short version of the deep-release ratio.'),
      session(1, 'ujjayi', 10, 'Warm ocean exhale to unwind.', 'Subtle throat resonance with slow exhale.'),
      session(2, 'grounding', 10, 'Root into stillness.', 'Long empty hold supports parasympathetic downshift.'),
      session(3, 'deep-release', 10, 'Deepen the 4-7-8 pattern.', 'Longer session for full relaxation response.'),
      session(4, 'lotus-heart', 10, 'Close with heart coherence.', 'Gentle equal rhythm to settle into the evening.'),
    ],
  },
];

export const DEFAULT_PROGRAM = PROGRAMS[0];

export const getProgramById = (id: string): Program | undefined =>
  PROGRAMS.find((program) => program.id === id);

export const getProgramDay = (program: Program, dayIndex: number): ProgramDay | undefined =>
  program.days.find((day) => day.dayIndex === dayIndex);

export const getNextSessionDay = (
  program: Program,
  progress: ActiveProgramProgress | null,
): ProgramSessionDay | undefined => {
  const completed = new Set(progress?.completedDays ?? []);
  for (let i = 0; i < program.durationDays; i += 1) {
    if (completed.has(i)) continue;
    const day = program.days[i];
    if (day?.type === 'session') return day;
  }
  return undefined;
};

export const isProgramComplete = (
  program: Program,
  progress: ActiveProgramProgress | null,
): boolean =>
  getNextSessionDay(program, progress) === undefined;

export const getProgramCompletionCount = (
  program: Program,
  progress: ActiveProgramProgress | null,
): number => {
  const completed = new Set(progress?.completedDays ?? []);
  return program.days.filter((day) => day.type === 'session' && completed.has(day.dayIndex)).length;
};

export const getProgramTotalSessions = (program: Program): number =>
  program.days.filter((day) => day.type === 'session').length;

export const resolveProgramSessionTechnique = (
  day: ProgramSessionDay,
  techniques: readonly SessionMode[],
): SessionMode => {
  const technique = techniques.find((t) => t.id === day.techniqueId);
  if (!technique) {
    throw new Error(`Program session references unknown technique "${day.techniqueId}"`);
  }
  return technique;
};
