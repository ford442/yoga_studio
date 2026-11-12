/** Resolution scale ladder (render-target only; CSS size unchanged). */
export const RESOLUTION_SCALES = [1, 0.85, 0.7, 0.6] as const;

/** Step down when rolling p75 CPU frame time exceeds this (≈42fps). */
export const DOWN_P75_MS = 24;
/** Step up only when rolling p75 CPU frame time stays under this (≈83fps headroom). */
export const UP_P75_MS = 12;
/**
 * GPU pass budget. A scene pass past this is genuinely GPU-bound even when
 * rAF still looks healthy — that gap is how "lost smooth framerate" happens.
 */
export const GPU_DOWN_P75_MS = 12;
/** GPU headroom required before stepping anything back up. */
export const GPU_UP_P75_MS = 6;
/** Rolling sample window for p75. */
export const SAMPLE_WINDOW_MS = 2000;
/** Sustained good frames required before stepping back up (hysteresis). */
export const UP_HOLD_MS = 10_000;
/** Ignore the first frames after a tier change so resize cost doesn't cascade. */
export const COOLDOWN_MS = 1500;

export type ResolutionScale = (typeof RESOLUTION_SCALES)[number];

/**
 * Breath-field particle counts by `particleLevel`. Level 0 means the field is
 * off (no sim, no particle draw); WebGPU only — the WebGL2 fallback ignores it.
 */
export const PARTICLE_COUNTS = [0, 4096, 16384, 65536] as const;
export type ParticleLevel = 0 | 1 | 2 | 3;
export const MAX_PARTICLE_LEVEL: ParticleLevel = 3;

/** Dual-filter bloom chain depth. 0 = no bloom; capped at 5 mips. */
export const MAX_BLOOM_LEVELS = 5;
/** Bloom levels the GPU ladder steps through on the way down (then 0). */
export const BLOOM_LADDER = [5, 3, 0] as const;

/** Breath-field knobs. All default to off so callers that never opt in are unchanged. */
export interface FieldTier {
  particleLevel: ParticleLevel;
  /** Bloom mip count; only meaningful while `hdrEnabled`. */
  bloomLevels: number;
  /** Scene renders into an rgba16float target and is tone-mapped to the swap chain. */
  hdrEnabled: boolean;
}

export const FIELD_OFF: FieldTier = { particleLevel: 0, bloomLevels: 0, hdrEnabled: false };

export interface GovernorTier extends FieldTier {
  resolutionScale: ResolutionScale;
  /** Effective quality ceiling (0=mobile, 1=high). Never raises above the caller's base. */
  qualityPreset: 0 | 1;
  overlayEnabled: boolean;
}

/** What callers pass as a ceiling / seed: the field knobs are optional and default to off. */
export type GovernorTierInput = Omit<GovernorTier, keyof FieldTier> & Partial<FieldTier>;

/**
 * CPU-relief knobs. Unlike the tier these are not persisted — they describe
 * work the *page* should shed (chores, instructor video), and #77's layer
 * graph reads them out of diagnostics.
 */
export interface GovernorRelief {
  /** gpu-chores should stop scheduling work. */
  choresPaused: boolean;
  /** The instructor video layer should stop decoding. */
  instructorVideoEnabled: boolean;
}

export const DEFAULT_RELIEF: GovernorRelief = {
  choresPaused: false,
  instructorVideoEnabled: true,
};

/** Which signal, if either, is currently over budget. */
export type GovernorBound = 'gpu' | 'cpu' | null;

export interface GovernorSnapshot extends GovernorTier, GovernorRelief {
  /** Rolling p75 of the CPU frame delta (kept as the legacy `p75FrameMs`). */
  p75FrameMs: number | null;
  /** Rolling p75 of measured GPU pass time; null without `timestamp-query`. */
  p75GpuMs: number | null;
  /** Most recent per-pass GPU time (ms) by pass label; null without `timestamp-query`. */
  gpuPassBreakdown: Readonly<Record<string, number>> | null;
  /** Duration of the most recent gpu-chore, as reported by its breadcrumb. */
  lastChoreMs: number | null;
  /** Which signal drove the last step-down decision. */
  bound: GovernorBound;
  stepDownCount: number;
  /** True when the render loop should skip GPU work (tab hidden / completion). */
  paused: boolean;
}

export interface FrameGovernorOptions {
  /** Seed from a prior stable session (persisted). */
  initial?: Partial<GovernorTier>;
  /** Base tier from user/technique settings — governor never exceeds these. */
  base: GovernorTierInput;
}

const isScale = (v: unknown): v is ResolutionScale =>
  typeof v === 'number' && (RESOLUTION_SCALES as readonly number[]).includes(v);

const isParticleLevel = (v: unknown): v is ParticleLevel => v === 0 || v === 1 || v === 2 || v === 3;

const isBloomLevels = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_BLOOM_LEVELS;

const normalizeBase = (base: GovernorTierInput): GovernorTier => ({
  ...base,
  particleLevel: isParticleLevel(base.particleLevel) ? base.particleLevel : 0,
  bloomLevels: isBloomLevels(base.bloomLevels) ? base.bloomLevels : 0,
  hdrEnabled: base.hdrEnabled === true,
});

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

  const hdrEnabled = base.hdrEnabled && tier.hdrEnabled;
  return {
    resolutionScale: RESOLUTION_SCALES[scaleIdx] ?? base.resolutionScale,
    qualityPreset: Math.min(tier.qualityPreset, base.qualityPreset) as 0 | 1,
    overlayEnabled: base.overlayEnabled ? tier.overlayEnabled : false,
    particleLevel: Math.min(tier.particleLevel, base.particleLevel) as ParticleLevel,
    // Bloom reads the HDR target; without it there is nothing to bloom.
    bloomLevels: hdrEnabled ? Math.min(tier.bloomLevels, base.bloomLevels) : 0,
    hdrEnabled,
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
    particleLevel: isParticleLevel(initial?.particleLevel) ? initial.particleLevel : base.particleLevel,
    bloomLevels: isBloomLevels(initial?.bloomLevels) ? initial.bloomLevels : base.bloomLevels,
    hdrEnabled: typeof initial?.hdrEnabled === 'boolean' ? initial.hdrEnabled : base.hdrEnabled,
  };
  return clampTier(seeded, base);
};

export interface FrameGovernor {
  /** Update the ceiling from React props (performance mode, reduced motion, etc.). */
  setBase(base: GovernorTierInput): void;
  /** Mark whether the loop should skip GPU work. */
  setPaused(paused: boolean): void;
  /**
   * Record one frame delta. Returns the snapshot; `changed` is true when the
   * active tier moved (caller should resize the canvas).
   */
  noteFrame(nowMs: number, deltaMs: number): GovernorSnapshot & { changed: boolean };
  /**
   * Record one measured GPU frame time (ms, all passes). `breakdown` carries
   * the same sample per pass label so the ladder can shed the offending pass's
   * layer (bloom vs particles) first. Ignored while paused.
   */
  noteGpuPass(nowMs: number, gpuMs: number, breakdown?: Readonly<Record<string, number>>): void;
  /** Record the wall time of the last gpu-chore so diagnostics can show it. */
  noteChore(choreMs: number): void;
  getSnapshot(): GovernorSnapshot;
}

/**
 * Adaptive quality controller with two independent signals.
 *
 * `noteFrame` carries the CPU frame delta (React commit, submit, overlay draw,
 * video decode, GC); `noteGpuPass` carries measured GPU pass time when the
 * device has `timestamp-query`. They steer different ladders, because dropping
 * resolution does nothing for a video-decode hitch and pausing chores does
 * nothing for an 18ms scene pass.
 *
 * Pure timing logic — backends apply the snapshot to DPR and uniforms.
 */
export function createFrameGovernor(options: FrameGovernorOptions): FrameGovernor {
  let base = normalizeBase(options.base);
  let tier = defaultTier(base, options.initial);
  let relief: GovernorRelief = { ...DEFAULT_RELIEF };
  let stepDownCount = 0;
  let paused = false;
  let bound: GovernorBound = null;

  const samples: { t: number; dt: number }[] = [];
  const gpuSamples: { t: number; dt: number }[] = [];
  let cooldownUntil = 0;
  let goodSince: number | null = null;
  let lastP75: number | null = null;
  let lastGpuP75: number | null = null;
  let lastChoreMs: number | null = null;
  let lastBreakdown: Readonly<Record<string, number>> | null = null;

  const snapshot = (): GovernorSnapshot => ({
    ...tier,
    ...relief,
    p75FrameMs: lastP75,
    p75GpuMs: lastGpuP75,
    gpuPassBreakdown: lastBreakdown,
    lastChoreMs,
    bound,
    stepDownCount,
    paused,
  });

  const pruneWindow = (list: { t: number; dt: number }[], nowMs: number) => {
    const cutoff = nowMs - SAMPLE_WINDOW_MS;
    while (list.length > 0 && list[0].t < cutoff) list.shift();
  };

  const scaleIndex = () => RESOLUTION_SCALES.indexOf(tier.resolutionScale);
  const baseScaleIndex = () => RESOLUTION_SCALES.indexOf(base.resolutionScale);

  const setScaleIndex = (idx: number): boolean => {
    const next = RESOLUTION_SCALES[idx];
    if (next === undefined || next === tier.resolutionScale) return false;
    tier = { ...tier, resolutionScale: next };
    return true;
  };

  /**
   * GPU-bound ladder. Resolution first (it is the biggest per-pixel win), but
   * only down to 0.7 — the overlay and the quality preset are dropped before
   * the image collapses to 0.6.
   */
  const GPU_FLOOR_BEFORE_LAYERS = RESOLUTION_SCALES.indexOf(0.7);

  /** Next bloom depth down the ladder (5 → 3 → 0), or null when already off. */
  const nextBloomDown = (): number | null => {
    if (tier.bloomLevels <= 0) return null;
    return BLOOM_LADDER.find((levels) => levels < tier.bloomLevels) ?? 0;
  };

  const shedBloom = (): boolean => {
    const next = nextBloomDown();
    if (next === null) return false;
    tier = { ...tier, bloomLevels: next };
    return true;
  };

  /** Particles go down to the smallest field, not off — off is the very last GPU step. */
  const shedParticles = (): boolean => {
    if (tier.particleLevel <= 1) return false;
    tier = { ...tier, particleLevel: (tier.particleLevel - 1) as ParticleLevel };
    return true;
  };

  /** Cost of a pass group in the latest breakdown (0 when unknown). */
  const passCost = (...labels: string[]): number =>
    labels.reduce((sum, label) => sum + (lastBreakdown?.[label] ?? 0), 0);

  /**
   * Breath-field layers are optional eye candy, so they go before any pixel.
   * Whichever of bloom / particles the per-pass timer blames goes first; with
   * no breakdown (or a tie) bloom does, being the larger fill cost.
   */
  const stepDownField = (): boolean => {
    const bloomCost = passCost('bloom', 'tonemap');
    const particleCost = passCost('field-sim', 'particles');
    const order = particleCost > bloomCost ? [shedParticles, shedBloom] : [shedBloom, shedParticles];
    for (const shed of order) if (shed()) return true;
    if (tier.hdrEnabled) {
      tier = { ...tier, hdrEnabled: false, bloomLevels: 0 };
      return true;
    }
    return false;
  };

  const stepDownGpu = (): boolean => {
    if (stepDownField()) return true;
    const idx = scaleIndex();
    if (idx >= 0 && idx < GPU_FLOOR_BEFORE_LAYERS) return setScaleIndex(idx + 1);
    if (tier.qualityPreset === 1 && base.qualityPreset === 1) {
      tier = { ...tier, qualityPreset: 0 };
      return true;
    }
    if (tier.overlayEnabled && base.overlayEnabled) {
      tier = { ...tier, overlayEnabled: false };
      return true;
    }
    if (idx >= 0 && idx < RESOLUTION_SCALES.length - 1) return setScaleIndex(idx + 1);
    if (tier.particleLevel > 0) {
      tier = { ...tier, particleLevel: 0 };
      return true;
    }
    return false;
  };

  /**
   * CPU-bound ladder: shed page work, not pixels. Resolution is deliberately
   * absent — a smaller render target does not speed up video decode or GC.
   */
  const stepDownCpu = (): boolean => {
    if (!relief.choresPaused) {
      relief = { ...relief, choresPaused: true };
      return true;
    }
    if (tier.overlayEnabled && base.overlayEnabled) {
      tier = { ...tier, overlayEnabled: false };
      return true;
    }
    if (relief.instructorVideoEnabled) {
      relief = { ...relief, instructorVideoEnabled: false };
      return true;
    }
    // Nothing page-side left: fall back to the pixel ladder.
    return stepDownGpu();
  };

  const stepDown = (signal: Exclude<GovernorBound, null>): boolean => {
    const moved = signal === 'gpu' ? stepDownGpu() : stepDownCpu();
    if (moved) stepDownCount += 1;
    return moved;
  };

  /** Reverse of both ladders: restore page work first, then layers, then pixels. */
  const stepUp = (): boolean => {
    if (!relief.instructorVideoEnabled) {
      relief = { ...relief, instructorVideoEnabled: true };
      return true;
    }
    if (relief.choresPaused) {
      relief = { ...relief, choresPaused: false };
      return true;
    }
    if (tier.particleLevel === 0 && base.particleLevel > 0) {
      tier = { ...tier, particleLevel: 1 };
      return true;
    }
    if (!tier.overlayEnabled && base.overlayEnabled) {
      tier = { ...tier, overlayEnabled: true };
      return true;
    }
    if (tier.qualityPreset < base.qualityPreset) {
      tier = { ...tier, qualityPreset: base.qualityPreset };
      return true;
    }
    const idx = scaleIndex();
    if (idx > baseScaleIndex() && idx > 0) return setScaleIndex(idx - 1);
    // Field layers come back last, in reverse of how they were shed.
    if (!tier.hdrEnabled && base.hdrEnabled) {
      tier = { ...tier, hdrEnabled: true };
      return true;
    }
    if (tier.particleLevel < base.particleLevel) {
      tier = { ...tier, particleLevel: (tier.particleLevel + 1) as ParticleLevel };
      return true;
    }
    if (tier.hdrEnabled && tier.bloomLevels < base.bloomLevels) {
      const next = [...BLOOM_LADDER].reverse().find((levels) => levels > tier.bloomLevels) ?? base.bloomLevels;
      tier = { ...tier, bloomLevels: Math.min(next, base.bloomLevels) };
      return true;
    }
    return false;
  };

  const upAvailable = (): boolean =>
    !relief.instructorVideoEnabled ||
    relief.choresPaused ||
    (!tier.overlayEnabled && base.overlayEnabled) ||
    tier.qualityPreset < base.qualityPreset ||
    (scaleIndex() > baseScaleIndex() && scaleIndex() > 0) ||
    (!tier.hdrEnabled && base.hdrEnabled) ||
    tier.particleLevel < base.particleLevel ||
    (tier.hdrEnabled && tier.bloomLevels < base.bloomLevels);

  return {
    setBase(nextBase) {
      const previous = base;
      base = normalizeBase(nextBase);
      // A newly opened field ceiling (user turned the breath field on) starts
      // at the ceiling rather than waiting out UP_HOLD_MS per level.
      const opened: Partial<FieldTier> = {};
      if (previous.particleLevel === 0 && base.particleLevel > 0) opened.particleLevel = base.particleLevel;
      if (!previous.hdrEnabled && base.hdrEnabled) {
        opened.hdrEnabled = true;
        opened.bloomLevels = base.bloomLevels;
      }
      tier = clampTier({ ...tier, ...opened }, base);
    },

    setPaused(next) {
      paused = next;
    },

    noteGpuPass(nowMs, gpuMs, breakdown) {
      if (paused) return;
      if (!Number.isFinite(gpuMs) || gpuMs < 0) return;
      if (breakdown) lastBreakdown = breakdown;
      gpuSamples.push({ t: nowMs, dt: gpuMs });
      pruneWindow(gpuSamples, nowMs);
      lastGpuP75 = percentile(gpuSamples.map((s) => s.dt), 75);
    },

    noteChore(choreMs) {
      if (Number.isFinite(choreMs) && choreMs >= 0) lastChoreMs = choreMs;
    },

    noteFrame(nowMs, deltaMs) {
      // Clamp absurd deltas (tab resume, debugger) so they don't force an instant step-down.
      const dt = Math.min(Math.max(deltaMs, 0), 100);
      if (!paused && dt > 0) {
        samples.push({ t: nowMs, dt });
        pruneWindow(samples, nowMs);
        pruneWindow(gpuSamples, nowMs);
      }

      let changed = false;

      if (!paused && nowMs >= cooldownUntil && samples.length >= 12) {
        lastP75 = percentile(
          samples.map((s) => s.dt),
          75,
        );
        lastGpuP75 = gpuSamples.length > 0
          ? percentile(gpuSamples.map((s) => s.dt), 75)
          : null;

        // GPU time wins the tie: an over-budget pass is the one signal the CPU
        // delta cannot explain away, and it is the one #40 kept missing.
        const gpuHot = lastGpuP75 != null && lastGpuP75 > GPU_DOWN_P75_MS;
        const cpuHot = lastP75 > DOWN_P75_MS;
        const signal: GovernorBound = gpuHot ? 'gpu' : cpuHot ? 'cpu' : null;

        if (signal) {
          bound = signal;
          goodSince = null;
          if (stepDown(signal)) {
            changed = true;
            samples.length = 0;
            gpuSamples.length = 0;
            cooldownUntil = nowMs + COOLDOWN_MS;
          }
        } else {
          bound = null;
          const gpuCalm = lastGpuP75 == null || lastGpuP75 < GPU_UP_P75_MS;
          if (lastP75 < UP_P75_MS && gpuCalm && upAvailable()) {
            if (goodSince === null) goodSince = nowMs;
            if (nowMs - goodSince >= UP_HOLD_MS && stepUp()) {
              changed = true;
              goodSince = null;
              samples.length = 0;
              gpuSamples.length = 0;
              cooldownUntil = nowMs + COOLDOWN_MS;
            }
          } else {
            goodSince = null;
          }
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
  if (isParticleLevel(data.particleLevel)) out.particleLevel = data.particleLevel;
  if (isBloomLevels(data.bloomLevels)) out.bloomLevels = data.bloomLevels;
  if (typeof data.hdrEnabled === 'boolean') out.hdrEnabled = data.hdrEnabled;
  return Object.keys(out).length > 0 ? out : undefined;
}
