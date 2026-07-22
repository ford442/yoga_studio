/** Resolution scale ladder (render-target only; CSS size unchanged). */
export const RESOLUTION_SCALES = [1, 0.85, 0.7, 0.6] as const;

/** Step down when rolling p75 frame time exceeds this (≈42fps). */
export const DOWN_P75_MS = 24;
/** Step up only when rolling p75 stays under this (≈83fps headroom). */
export const UP_P75_MS = 12;
/** Rolling sample window for p75. */
export const SAMPLE_WINDOW_MS = 2000;
/** Sustained good frames required before stepping back up (hysteresis). */
export const UP_HOLD_MS = 10_000;
/** Ignore the first frames after a tier change so resize cost doesn't cascade. */
export const COOLDOWN_MS = 1500;

export type ResolutionScale = (typeof RESOLUTION_SCALES)[number];

export interface GovernorTier {
  resolutionScale: ResolutionScale;
  /** Effective quality ceiling (0=mobile, 1=high). Never raises above the caller's base. */
  qualityPreset: 0 | 1;
  overlayEnabled: boolean;
}

export interface GovernorSnapshot extends GovernorTier {
  p75FrameMs: number | null;
  stepDownCount: number;
  /** True when the render loop should skip GPU work (tab hidden / completion). */
  paused: boolean;
}

export interface FrameGovernorOptions {
  /** Seed from a prior stable session (persisted). */
  initial?: Partial<GovernorTier>;
  /** Base tier from user/technique settings — governor never exceeds these. */
  base: GovernorTier;
}

const isScale = (v: unknown): v is ResolutionScale =>
  typeof v === 'number' && (RESOLUTION_SCALES as readonly number[]).includes(v);

/** Percentile of a non-empty numeric sample list (linear interpolation unused — nearest-rank). */
export function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

const clampTier = (tier: GovernorTier, base: GovernorTier): GovernorTier => {
  // Indices increase as quality drops: [1, 0.85, 0.7, 0.6]. Base is the ceiling
  // (lowest allowed index) — never step up past base.resolutionScale.
  const baseIdx = RESOLUTION_SCALES.indexOf(base.resolutionScale);
  const wantIdx = RESOLUTION_SCALES.indexOf(tier.resolutionScale);
  const scaleIdx = Math.max(wantIdx < 0 ? baseIdx : wantIdx, baseIdx);

  return {
    resolutionScale: RESOLUTION_SCALES[scaleIdx] ?? base.resolutionScale,
    qualityPreset: Math.min(tier.qualityPreset, base.qualityPreset) as 0 | 1,
    overlayEnabled: base.overlayEnabled ? tier.overlayEnabled : false,
  };
};

const defaultTier = (base: GovernorTier, initial?: Partial<GovernorTier>): GovernorTier => {
  const seeded: GovernorTier = {
    resolutionScale: isScale(initial?.resolutionScale) ? initial.resolutionScale : base.resolutionScale,
    qualityPreset: initial?.qualityPreset === 0 || initial?.qualityPreset === 1
      ? initial.qualityPreset
      : base.qualityPreset,
    overlayEnabled:
      typeof initial?.overlayEnabled === 'boolean' ? initial.overlayEnabled : base.overlayEnabled,
  };
  return clampTier(seeded, base);
};

export interface FrameGovernor {
  /** Update the ceiling from React props (performance mode, reduced motion, etc.). */
  setBase(base: GovernorTier): void;
  /** Mark whether the loop should skip GPU work. */
  setPaused(paused: boolean): void;
  /**
   * Record one frame delta. Returns the snapshot; `changed` is true when the
   * active tier moved (caller should resize the canvas).
   */
  noteFrame(nowMs: number, deltaMs: number): GovernorSnapshot & { changed: boolean };
  getSnapshot(): GovernorSnapshot;
}

/**
 * Adaptive quality controller: rolling p75 frame time → resolution / quality / overlay steps.
 * Pure timing logic — backends apply the snapshot to DPR and uniforms.
 */
export function createFrameGovernor(options: FrameGovernorOptions): FrameGovernor {
  let base = options.base;
  let tier = defaultTier(base, options.initial);
  let stepDownCount = 0;
  let paused = false;

  const samples: { t: number; dt: number }[] = [];
  let cooldownUntil = 0;
  let goodSince: number | null = null;
  let lastP75: number | null = null;

  const snapshot = (): GovernorSnapshot => ({
    ...tier,
    p75FrameMs: lastP75,
    stepDownCount,
    paused,
  });

  const prune = (nowMs: number) => {
    const cutoff = nowMs - SAMPLE_WINDOW_MS;
    while (samples.length > 0 && samples[0].t < cutoff) samples.shift();
  };

  const stepDown = (): boolean => {
    const idx = RESOLUTION_SCALES.indexOf(tier.resolutionScale);
    if (idx >= 0 && idx < RESOLUTION_SCALES.length - 1) {
      tier = { ...tier, resolutionScale: RESOLUTION_SCALES[idx + 1] };
      stepDownCount += 1;
      return true;
    }
    if (tier.qualityPreset === 1 && base.qualityPreset === 1) {
      tier = { ...tier, qualityPreset: 0 };
      stepDownCount += 1;
      return true;
    }
    if (tier.overlayEnabled && base.overlayEnabled) {
      tier = { ...tier, overlayEnabled: false };
      stepDownCount += 1;
      return true;
    }
    return false;
  };

  const stepUp = (): boolean => {
    // Reverse order: overlay → quality → scale
    if (!tier.overlayEnabled && base.overlayEnabled) {
      tier = { ...tier, overlayEnabled: true };
      return true;
    }
    if (tier.qualityPreset < base.qualityPreset) {
      tier = { ...tier, qualityPreset: base.qualityPreset };
      return true;
    }
    const idx = RESOLUTION_SCALES.indexOf(tier.resolutionScale);
    const baseIdx = RESOLUTION_SCALES.indexOf(base.resolutionScale);
    if (idx > baseIdx && idx > 0) {
      tier = { ...tier, resolutionScale: RESOLUTION_SCALES[idx - 1] };
      return true;
    }
    return false;
  };

  return {
    setBase(nextBase) {
      base = nextBase;
      tier = clampTier(tier, base);
    },

    setPaused(next) {
      paused = next;
    },

    noteFrame(nowMs, deltaMs) {
      // Clamp absurd deltas (tab resume, debugger) so they don't force an instant step-down.
      const dt = Math.min(Math.max(deltaMs, 0), 100);
      if (!paused && dt > 0) {
        samples.push({ t: nowMs, dt });
        prune(nowMs);
      }

      let changed = false;

      if (!paused && nowMs >= cooldownUntil && samples.length >= 12) {
        lastP75 = percentile(
          samples.map((s) => s.dt),
          75,
        );

        if (lastP75 > DOWN_P75_MS) {
          goodSince = null;
          if (stepDown()) {
            changed = true;
            samples.length = 0;
            cooldownUntil = nowMs + COOLDOWN_MS;
          }
        } else if (lastP75 < UP_P75_MS) {
          const idx = RESOLUTION_SCALES.indexOf(tier.resolutionScale);
          const baseIdx = RESOLUTION_SCALES.indexOf(base.resolutionScale);
          const upAvailable =
            (!tier.overlayEnabled && base.overlayEnabled) ||
            tier.qualityPreset < base.qualityPreset ||
            (idx > baseIdx && idx > 0);

          if (upAvailable) {
            if (goodSince === null) goodSince = nowMs;
            if (nowMs - goodSince >= UP_HOLD_MS && stepUp()) {
              changed = true;
              goodSince = null;
              samples.length = 0;
              cooldownUntil = nowMs + COOLDOWN_MS;
            }
          } else {
            goodSince = null;
          }
        } else {
          goodSince = null;
        }
      }

      return { ...snapshot(), changed };
    },

    getSnapshot: snapshot,
  };
}

/** Validate a persisted tier blob from localStorage. */
export function parseGovernorTier(raw: unknown): Partial<GovernorTier> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const data = raw as Partial<GovernorTier>;
  const out: Partial<GovernorTier> = {};
  if (isScale(data.resolutionScale)) out.resolutionScale = data.resolutionScale;
  if (data.qualityPreset === 0 || data.qualityPreset === 1) out.qualityPreset = data.qualityPreset;
  if (typeof data.overlayEnabled === 'boolean') out.overlayEnabled = data.overlayEnabled;
  return Object.keys(out).length > 0 ? out : undefined;
}
