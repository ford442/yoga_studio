/**
 * Pure phase-schedule primitives for the breath engine.
 *
 * The engine is driven by a monotonic clock anchored at session start; every
 * consumer (countdown, audio, instructor video, shader) derives its state by
 * looking the elapsed time up in the schedule below rather than accumulating
 * per-frame deltas. That keeps the three consumers on one timeline and makes
 * phase boundaries exact rather than frame-quantised.
 */

export type BreathPhase = 'inhale' | 'hold1' | 'exhale' | 'hold2';

export interface BreathSettings {
  inhale: number;
  hold1: number;
  exhale: number;
  hold2: number;
}

/** One phase occupying [startMs, endMs) of the cycle. Zero-length phases are omitted. */
export interface PhaseSlot {
  phase: BreathPhase;
  startMs: number;
  endMs: number;
  durationSec: number;
}

export interface BreathSchedule {
  slots: PhaseSlot[];
  cycleMs: number;
  totalCycleSec: number;
}

/** Resolved timeline state at one instant. */
export interface PhaseSnapshot {
  phase: BreathPhase;
  /** Seconds elapsed inside the current phase. */
  phaseElapsedSec: number;
  /** Length of the current phase in seconds (0 only for a degenerate schedule). */
  phaseDurationSec: number;
  /** 0..1 position inside the current phase. */
  phaseProgress: number;
  /** Seconds left in the current phase (never negative). */
  remainingSec: number;
  /** 0..1 position inside the full cycle — the legacy `breathPhase` value. */
  cycleProgress: number;
  /** Number of whole cycles completed since the timeline origin. */
  cycleIndex: number;
  /** Index of the current slot within `schedule.slots`. */
  slotIndex: number;
  /** Strictly increasing ordinal of this phase since the origin (cycleIndex * slots + slotIndex). */
  phaseOrdinal: number;
  /** Monotonic timestamp offset (ms since origin) at which the current phase began. */
  phaseStartMs: number;
  /** Monotonic timestamp offset (ms since origin) at which the next phase begins. */
  nextPhaseStartMs: number;
  /** The phase that begins at `nextPhaseStartMs`. */
  nextPhase: BreathPhase;
}

const PHASE_ORDER: BreathPhase[] = ['inhale', 'hold1', 'exhale', 'hold2'];

const EMPTY_SNAPSHOT: PhaseSnapshot = {
  phase: 'inhale',
  phaseElapsedSec: 0,
  phaseDurationSec: 0,
  phaseProgress: 0,
  remainingSec: 0,
  cycleProgress: 0,
  cycleIndex: 0,
  slotIndex: 0,
  phaseOrdinal: 0,
  phaseStartMs: 0,
  nextPhaseStartMs: 0,
  nextPhase: 'inhale',
};

/**
 * Precomputes the cycle layout for a settings object.
 * Phases configured to 0s (e.g. the holds in 4-7-8) are dropped entirely, so a
 * lookup can never land on a phase the practitioner is meant to skip.
 */
export function buildPhaseSchedule(settings: BreathSettings): BreathSchedule {
  const slots: PhaseSlot[] = [];
  let cursor = 0;

  for (const phase of PHASE_ORDER) {
    const durationSec = Math.max(0, settings[phase]);
    if (durationSec <= 0) continue;
    const durationMs = durationSec * 1000;
    slots.push({ phase, startMs: cursor, endMs: cursor + durationMs, durationSec });
    cursor += durationMs;
  }

  return { slots, cycleMs: cursor, totalCycleSec: cursor / 1000 };
}

/** Whole cycles completed after `elapsedMs`. Returns 0 for a degenerate schedule. */
export function countCompletedCycles(schedule: BreathSchedule, elapsedMs: number): number {
  if (schedule.cycleMs <= 0) return 0;
  return Math.floor(Math.max(0, elapsedMs) / schedule.cycleMs);
}

/**
 * Looks up the timeline state at `elapsedMs` past the schedule origin.
 * Pure and total: negative input clamps to 0, an all-zero schedule yields a
 * neutral snapshot rather than throwing.
 */
export function resolvePhaseAt(schedule: BreathSchedule, elapsedMs: number): PhaseSnapshot {
  const { slots, cycleMs } = schedule;
  if (cycleMs <= 0 || slots.length === 0) return EMPTY_SNAPSHOT;

  const elapsed = Math.max(0, elapsedMs);
  const cycleIndex = Math.floor(elapsed / cycleMs);
  const withinCycle = elapsed - cycleIndex * cycleMs;

  let slotIndex = slots.length - 1;
  for (let i = 0; i < slots.length; i++) {
    if (withinCycle < slots[i].endMs) {
      slotIndex = i;
      break;
    }
  }

  const slot = slots[slotIndex];
  const cycleOriginMs = cycleIndex * cycleMs;
  const phaseElapsedMs = Math.min(withinCycle - slot.startMs, slot.endMs - slot.startMs);
  const phaseElapsedSec = Math.max(0, phaseElapsedMs) / 1000;
  const phaseProgress = Math.min(1, phaseElapsedSec / slot.durationSec);
  const nextSlot = slots[(slotIndex + 1) % slots.length];

  return {
    phase: slot.phase,
    phaseElapsedSec,
    phaseDurationSec: slot.durationSec,
    phaseProgress,
    remainingSec: Math.max(0, slot.durationSec - phaseElapsedSec),
    cycleProgress: withinCycle / cycleMs,
    cycleIndex,
    slotIndex,
    phaseOrdinal: cycleIndex * slots.length + slotIndex,
    phaseStartMs: cycleOriginMs + slot.startMs,
    nextPhaseStartMs: cycleOriginMs + slot.endMs,
    nextPhase: nextSlot.phase,
  };
}
