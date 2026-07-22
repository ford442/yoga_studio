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
  phaseProgress: number;
  phaseDurationSec: number;
  clipDuration: number;
  currentTime: number;
}

export type PlaybackRateResult = { rate: number } | { seekTo: number };

/**
 * Anticipated media time for the current phase progress.
 * Leads the countdown by ANTICIPATION_LEAD_SEC so the clip feels human.
 */
export function computeTargetTime(
  phaseProgress: number,
  phaseDurationSec: number,
  clipDuration: number,
): number {
  const lead = ANTICIPATION_LEAD_SEC / phaseDurationSec;
  const tp = clamp(phaseProgress + lead, 0, 1);
  return tp * clipDuration;
}

/**
 * Velocity-control decision for locking a clip to the breath countdown.
 * Returns a hard seek when drift is large; otherwise a clamped playback rate.
 */
export function computePlaybackRate(input: PlaybackRateInput): PlaybackRateResult {
  const { phaseProgress, phaseDurationSec, clipDuration, currentTime } = input;
  const target = computeTargetTime(phaseProgress, phaseDurationSec, clipDuration);
  const drift = target - currentTime;

  if (Math.abs(drift) > HARD_SNAP_SEC) {
    return { seekTo: target };
  }

  const idealRate = clipDuration / phaseDurationSec;
  const rate = clamp(idealRate + RATE_GAIN * drift, RATE_MIN, RATE_MAX);
  return { rate };
}
