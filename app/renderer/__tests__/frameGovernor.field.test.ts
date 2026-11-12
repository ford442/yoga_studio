import { describe, expect, it } from 'vitest';
import {
  COOLDOWN_MS,
  GPU_DOWN_P75_MS,
  SAMPLE_WINDOW_MS,
  UP_HOLD_MS,
  createFrameGovernor,
  parseGovernorTier,
  type FrameGovernor,
  type GovernorSnapshot,
  type GovernorTierInput,
} from '../frameGovernor';

/** WebGPU + breath field at full HDR: 64k particles, 5 bloom mips. */
const fieldBase: GovernorTierInput = {
  resolutionScale: 1,
  qualityPreset: 1,
  overlayEnabled: true,
  particleLevel: 3,
  bloomLevels: 5,
  hdrEnabled: true,
};

type Knobs = Pick<GovernorSnapshot, 'resolutionScale' | 'qualityPreset' | 'overlayEnabled' | 'particleLevel' | 'bloomLevels' | 'hdrEnabled'>;
const knobs = (snap: GovernorSnapshot): Knobs => ({
  resolutionScale: snap.resolutionScale,
  qualityPreset: snap.qualityPreset,
  overlayEnabled: snap.overlayEnabled,
  particleLevel: snap.particleLevel,
  bloomLevels: snap.bloomLevels,
  hdrEnabled: snap.hdrEnabled,
});

/**
 * Feed a throttled GPU (fake per-pass times through `noteGpuPass`, as the
 * timestamp timer would) until the governor takes exactly one step down.
 */
function stepDownUnderGpuLoad(
  g: FrameGovernor,
  clock: { now: number },
  breakdown?: Record<string, number>,
): Knobs | null {
  const total = GPU_DOWN_P75_MS + 6;
  for (let i = 0; i < 400; i += 1) {
    clock.now += 16;
    g.noteGpuPass(clock.now, total, breakdown);
    // CPU delta is healthy: this is purely GPU-bound.
    if (g.noteFrame(clock.now, 16).changed) return knobs(g.getSnapshot());
  }
  return null;
}

describe('frameGovernor breath-field ladder', () => {
  it('defaults the field knobs to off when the base omits them', () => {
    const g = createFrameGovernor({ base: { resolutionScale: 1, qualityPreset: 1, overlayEnabled: true } });
    expect(knobs(g.getSnapshot())).toMatchObject({ particleLevel: 0, bloomLevels: 0, hdrEnabled: false });
  });

  it('sheds bloom, then particles, then HDR — all before any resolution', () => {
    const g = createFrameGovernor({ base: fieldBase });
    const clock = { now: COOLDOWN_MS + 100 };
    const steps: Knobs[] = [];
    for (let i = 0; i < 6; i += 1) {
      const step = stepDownUnderGpuLoad(g, clock);
      if (step) steps.push(step);
    }

    expect(steps.map((s) => [s.bloomLevels, s.particleLevel, s.hdrEnabled, s.resolutionScale])).toEqual([
      [3, 3, true, 1], // bloom 5 → 3
      [0, 3, true, 1], // bloom 3 → off
      [0, 2, true, 1], // particles 64k → 16k
      [0, 1, true, 1], // particles 16k → 4k (smallest field, not off)
      [0, 1, false, 1], // HDR target + tone map off
      [0, 1, false, 0.85], // only now does resolution move
    ]);
  });

  it('sheds particles first when the per-pass breakdown blames them', () => {
    const g = createFrameGovernor({ base: fieldBase });
    const clock = { now: COOLDOWN_MS + 100 };
    const breakdown = { scene: 4, 'field-sim': 5, particles: 6, bloom: 2, tonemap: 1, overlay: 0.5 };

    const first = stepDownUnderGpuLoad(g, clock, breakdown);
    expect(first).toMatchObject({ particleLevel: 2, bloomLevels: 5 });
    const second = stepDownUnderGpuLoad(g, clock, breakdown);
    expect(second).toMatchObject({ particleLevel: 1, bloomLevels: 5 });
    // Particles are at their floor, so bloom is next even though it costs less.
    const third = stepDownUnderGpuLoad(g, clock, breakdown);
    expect(third).toMatchObject({ particleLevel: 1, bloomLevels: 3 });
    expect(g.getSnapshot().gpuPassBreakdown).toEqual(breakdown);
  });

  it('turns particles off only after the pixel ladder is exhausted', () => {
    const g = createFrameGovernor({ base: fieldBase });
    const clock = { now: COOLDOWN_MS + 100 };
    let last: Knobs | null = null;
    for (let i = 0; i < 20; i += 1) {
      const step = stepDownUnderGpuLoad(g, clock);
      if (!step) break;
      last = step;
      if (step.particleLevel === 0) break;
    }
    expect(last).toMatchObject({
      particleLevel: 0,
      resolutionScale: 0.6,
      qualityPreset: 0,
      overlayEnabled: false,
      hdrEnabled: false,
      bloomLevels: 0,
    });
  });

  it('restores field layers last on the way back up', () => {
    const g = createFrameGovernor({
      base: fieldBase,
      initial: { resolutionScale: 0.85, particleLevel: 1, bloomLevels: 0, hdrEnabled: false },
    });
    const ups: Knobs[] = [];
    let now = 0;
    for (let i = 0; i < 8; i += 1) {
      const target = now + UP_HOLD_MS + SAMPLE_WINDOW_MS + COOLDOWN_MS;
      while (now < target) {
        now += 8;
        g.noteGpuPass(now, 2);
        if (g.noteFrame(now, 8).changed) {
          ups.push(knobs(g.getSnapshot()));
          break;
        }
      }
    }
    expect(ups[0]).toMatchObject({ resolutionScale: 1, hdrEnabled: false, particleLevel: 1 });
    expect(ups[1]).toMatchObject({ hdrEnabled: true, bloomLevels: 0 });
    expect(ups[2]).toMatchObject({ particleLevel: 2 });
    expect(ups[3]).toMatchObject({ particleLevel: 3 });
    expect(ups[4]).toMatchObject({ bloomLevels: 3 });
    expect(ups[5]).toMatchObject({ bloomLevels: 5 });
  });

  it('jumps straight to a newly opened field ceiling instead of climbing per level', () => {
    const g = createFrameGovernor({ base: { resolutionScale: 1, qualityPreset: 1, overlayEnabled: true } });
    g.setBase(fieldBase);
    expect(knobs(g.getSnapshot())).toMatchObject({ particleLevel: 3, bloomLevels: 5, hdrEnabled: true });
    // Turning it back off clamps to zero immediately.
    g.setBase({ resolutionScale: 1, qualityPreset: 1, overlayEnabled: true });
    expect(knobs(g.getSnapshot())).toMatchObject({ particleLevel: 0, bloomLevels: 0, hdrEnabled: false });
  });

  it('never blooms without the HDR target', () => {
    const g = createFrameGovernor({ base: { ...fieldBase, hdrEnabled: false } });
    expect(knobs(g.getSnapshot())).toMatchObject({ hdrEnabled: false, bloomLevels: 0, particleLevel: 3 });
  });

  it('persists and validates the field knobs', () => {
    expect(parseGovernorTier({ particleLevel: 2, bloomLevels: 3, hdrEnabled: true })).toEqual({
      particleLevel: 2,
      bloomLevels: 3,
      hdrEnabled: true,
    });
    expect(parseGovernorTier({ particleLevel: 7, bloomLevels: 9, hdrEnabled: 'yes' })).toBeUndefined();
  });
});
