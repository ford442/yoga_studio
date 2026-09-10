/** Anticipation lead so movement feels slightly ahead of the numeric countdown. */
export const ANTICIPATION_LEAD_SEC = 0.2;
/** Velocity-control gain: rate = idealRate + GAIN * drift. */
export const RATE_GAIN = 4;
/** Soft rate envelope — slow enough to fill a long phase, capped for short phases. */
export const RATE_MIN = 0.1;
export const RATE_MAX = 3.0;
/** Only hard-seek when drift exceeds this (stall / tab backgrounded). */
export const HARD_SNAP_SEC = 0.5;
/** Minimum phase duration (seconds) before lockstep sync engages. */
export const SYNC_MIN_PHASE_SEC = 0.05;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface PlaybackRateInput {
  /** Seconds elapsed in the current phase, straight from the breath schedule. */
  phaseElapsedSec: number;
  phaseDurationSec: number;
  clipDuration: number;
  currentTime: number;
}

export type PlaybackRateResult = { rate: number } | { seekTo: number };

/**
 * Anticipated media time for a phase position expressed in seconds elapsed.
 * This is the canonical entry point: the breath engine resolves elapsed seconds
 * from its monotonic schedule, so no React-interpolated progress is involved.
 * Leads the countdown by ANTICIPATION_LEAD_SEC so the clip feels human.
 */
export function computeTargetTimeFromElapsed(
  phaseElapsedSec: number,
  phaseDurationSec: number,
  clipDuration: number,
): number {
  if (phaseDurationSec <= 0) return 0;
  const led = phaseElapsedSec + ANTICIPATION_LEAD_SEC;
  const tp = clamp(led / phaseDurationSec, 0, 1);
  return tp * clipDuration;
}

/** Progress-based convenience wrapper over {@link computeTargetTimeFromElapsed}. */
export function computeTargetTime(
  phaseProgress: number,
  phaseDurationSec: number,
  clipDuration: number,
): number {
  return computeTargetTimeFromElapsed(
    phaseProgress * phaseDurationSec,
    phaseDurationSec,
    clipDuration,
  );
}

/**
 * Velocity-control decision for locking a clip to the breath countdown.
 * Returns a hard seek when drift is large; otherwise a clamped playback rate.
 */
export function computePlaybackRate(input: PlaybackRateInput): PlaybackRateResult {
  const { phaseElapsedSec, phaseDurationSec, clipDuration, currentTime } = input;
  const target = computeTargetTimeFromElapsed(phaseElapsedSec, phaseDurationSec, clipDuration);
  const drift = target - currentTime;

  if (Math.abs(drift) > HARD_SNAP_SEC) {
    return { seekTo: target };
  }

  const idealRate = clipDuration / phaseDurationSec;
  const rate = clamp(idealRate + RATE_GAIN * drift, RATE_MIN, RATE_MAX);
  return { rate };
}
