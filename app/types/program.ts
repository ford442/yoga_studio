import type { PracticeGoal, TechniqueDifficulty } from './technique';

export type ProgramDuration = 5 | 10 | 15 | 'free';

export interface ProgramSessionDay {
  type: 'session';
  /** Zero-based day index within the program */
  dayIndex: number;
  /** Technique id from TECHNIQUES */
  techniqueId: string;
  /** Scheduled practice length */
  durationMinutes: ProgramDuration;
  /** Optional one-line focus for this session */
  goal?: string;
  /** Optional guidance note displayed on the next-session card */
  note?: string;
}

export interface ProgramRestDay {
  type: 'rest';
  /** Zero-based day index within the program */
  dayIndex: number;
  /** Optional rest-day guidance */
  note?: string;
}

export type ProgramDay = ProgramSessionDay | ProgramRestDay;

export interface Program {
  id: string;
  label: string;
  emoji: string;
  description: string;
  goals: PracticeGoal[];
  difficulty: TechniqueDifficulty;
  /** Total length in days (must equal days.length) */
  durationDays: number;
  /** Ordered sequence of days */
  days: ProgramDay[];
}

export interface ActiveProgramProgress {
  programId: string;
  /** YYYY-MM-DD when the program was started */
  startDate: string;
  /** Day indices that have been completed */
  completedDays: number[];
  /** ISO timestamp of the most recent completion */
  lastCompletedAt?: string;
}
