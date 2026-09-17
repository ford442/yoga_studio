import { describe, it, expect } from 'vitest';
import {
  COOLDOWN_MS,
  DOWN_P75_MS,
  GPU_DOWN_P75_MS,
  SAMPLE_WINDOW_MS,
  UP_HOLD_MS,
  UP_P75_MS,
  createFrameGovernor,
  percentile,
  parseGovernorTier,
  type GovernorTier,
} from '../frameGovernor';

const highBase: GovernorTier = {
  resolutionScale: 1,
  qualityPreset: 1,
  overlayEnabled: true,
};

describe('percentile', () => {
  it('returns nearest-rank p75', () => {
    // 4 samples → ceil(0.75*4)-1 = 2 → third value when sorted
    expect(percentile([10, 20, 30, 40], 75)).toBe(30);
  });

  it('handles a single sample', () => {
    expect(percentile([16], 75)).toBe(16);
  });
});

describe('createFrameGovernor', () => {
  it('seeds from a persisted tier clamped to the base ceiling', () => {
    const g = createFrameGovernor({
      base: highBase,
      initial: { resolutionScale: 0.7, qualityPreset: 0, overlayEnabled: false },
    });
    const snap = g.getSnapshot();
    expect(snap.resolutionScale).toBe(0.7);
    expect(snap.qualityPreset).toBe(0);
    expect(snap.overlayEnabled).toBe(false);
  });

  it('never raises overlay above a disabled base', () => {
    const g = createFrameGovernor({
      base: { ...highBase, overlayEnabled: false },
      initial: { overlayEnabled: true },
    });
    expect(g.getSnapshot().overlayEnabled).toBe(false);
  });

  it('sheds page work, not pixels, when only the CPU delta is over budget', () => {
    const g = createFrameGovernor({ base: highBase });
    let now = 1000;
    // Slow JS frames with no GPU signal: video decode / GC / chores, not the shader.
    for (let i = 0; i < 40; i++) {
      now += 30;
      g.noteFrame(now, 30);
    }
    const snap = g.getSnapshot();
    expect(snap.p75FrameMs).toBeGreaterThan(DOWN_P75_MS);
    expect(snap.bound).toBe('cpu');
    expect(snap.choresPaused).toBe(true);
    // Dropping resolution would not buy back a single decode hitch.
    expect(snap.resolutionScale).toBe(1);
    expect(snap.stepDownCount).toBeGreaterThanOrEqual(1);
  });

  it('steps resolution down when the GPU pass is over budget', () => {
    const g = createFrameGovernor({ base: highBase });
    let now = 1000;
    for (let i = 0; i < 40; i++) {
      now += 16;
      g.noteGpuPass(now, GPU_DOWN_P75_MS + 6);
      g.noteFrame(now, 16);
    }
    const snap = g.getSnapshot();
    expect(snap.bound).toBe('gpu');
    expect(snap.p75GpuMs).toBeGreaterThan(GPU_DOWN_P75_MS);
    expect(snap.resolutionScale).toBeLessThan(1);
    expect(snap.choresPaused).toBe(false);
  });

  it('drops the overlay for GPU time without collapsing resolution to 0.6 first', () => {
    const g = createFrameGovernor({ base: highBase });
    let now = 1000;
    const scales: number[] = [];
    // A long GPU-bound stretch: enough steps to exhaust the early ladder.
    for (let i = 0; i < 2000; i += 1) {
      now += 16;
      g.noteGpuPass(now, GPU_DOWN_P75_MS + 6);
      const r = g.noteFrame(now, 16);
      if (r.changed) scales.push(r.resolutionScale);
      if (!g.getSnapshot().overlayEnabled) break;
    }
    const snap = g.getSnapshot();
    expect(snap.overlayEnabled).toBe(false);
    expect(snap.qualityPreset).toBe(0);
    // Overlay went before the last resolution rung.
    expect(snap.resolutionScale).toBe(0.7);
    expect(scales).not.toContain(0.6);
  });

  it('records the last chore duration for diagnostics', () => {
    const g = createFrameGovernor({ base: highBase });
    expect(g.getSnapshot().lastChoreMs).toBeNull();
    g.noteChore(4.25);
    expect(g.getSnapshot().lastChoreMs).toBe(4.25);
    g.noteChore(Number.NaN);
    expect(g.getSnapshot().lastChoreMs).toBe(4.25);
  });

  it('will not step up while the GPU pass is still hot', () => {
    const g = createFrameGovernor({ base: highBase, initial: { resolutionScale: 0.85 } });
    let now = 0;
    const target = UP_HOLD_MS + SAMPLE_WINDOW_MS + 1000;
    while (now < target) {
      now += 8;
      // rAF looks perfect, but the GPU is still deep in the shader.
      g.noteGpuPass(now, GPU_DOWN_P75_MS - 2);
      g.noteFrame(now, 8);
    }
    expect(g.getSnapshot().resolutionScale).toBe(0.85);
  });

  it('does not oscillate: requires UP_HOLD_MS of fast frames before stepping up', () => {
    const g = createFrameGovernor({
      base: highBase,
      initial: { resolutionScale: 0.85 },
    });

    let now = 0;
    // Establish fast p75 briefly — not long enough to step up
    for (let i = 0; i < 30; i++) {
      now += 8;
      const r = g.noteFrame(now, 8);
      expect(r.resolutionScale).toBe(0.85);
    }
    expect(now).toBeLessThan(UP_HOLD_MS);

    // Hold fast frames past UP_HOLD_MS + sample window
    const target = now + UP_HOLD_MS + SAMPLE_WINDOW_MS;
    while (now < target) {
      now += 8;
      g.noteFrame(now, 8);
    }
    expect(g.getSnapshot().resolutionScale).toBe(1);
  });

  it('applies cooldown so a single bad stretch cannot cascade every frame', () => {
    const g = createFrameGovernor({ base: highBase });
    let now = 0;
    const scales: number[] = [];

    for (let i = 0; i < 200; i++) {
      now += 40;
      const r = g.noteFrame(now, 40);
      if (r.changed) scales.push(r.resolutionScale);
    }

    // With COOLDOWN_MS between steps, we should not burn the whole ladder in < cooldown*3
    expect(scales.length).toBeGreaterThanOrEqual(1);
    expect(scales.length).toBeLessThanOrEqual(Math.ceil((200 * 40) / COOLDOWN_MS) + 1);
    // Adjacent step-downs should be spaced by cooldown
    expect(g.getSnapshot().resolutionScale).toBeLessThanOrEqual(0.85);
  });

  it('drops quality then overlay once the GPU scale ladder is exhausted', () => {
    const g = createFrameGovernor({
      base: highBase,
      initial: { resolutionScale: 0.7 },
    });

    let now = COOLDOWN_MS + 100;
    for (let i = 0; i < 40; i++) {
      now += 30;
      g.noteGpuPass(now, GPU_DOWN_P75_MS + 6);
      g.noteFrame(now, 30);
    }
    expect(g.getSnapshot().qualityPreset).toBe(0);

    now += COOLDOWN_MS + SAMPLE_WINDOW_MS;
    for (let i = 0; i < 40; i++) {
      now += 30;
      g.noteGpuPass(now, GPU_DOWN_P75_MS + 6);
      g.noteFrame(now, 30);
    }
    expect(g.getSnapshot().overlayEnabled).toBe(false);
  });

  it('exhausts the CPU ladder before touching pixels', () => {
    const g = createFrameGovernor({ base: highBase });
    let now = 0;
    for (let i = 0; i < 600; i += 1) {
      now += 40;
      g.noteFrame(now, 40);
    }
    const snap = g.getSnapshot();
    expect(snap.choresPaused).toBe(true);
    expect(snap.overlayEnabled).toBe(false);
    // The signal #77's layer graph reads to stop decoding the instructor video.
    expect(snap.instructorVideoEnabled).toBe(false);
  });

  it('ignores frame samples while paused', () => {
    const g = createFrameGovernor({ base: highBase });
    g.setPaused(true);
    let now = 0;
    for (let i = 0; i < 40; i++) {
      now += 40;
      g.noteFrame(now, 40);
    }
    expect(g.getSnapshot().resolutionScale).toBe(1);
    expect(g.getSnapshot().p75FrameMs).toBeNull();
  });
});

describe('parseGovernorTier', () => {
  it('accepts a valid persisted blob', () => {
    expect(parseGovernorTier({ resolutionScale: 0.85, qualityPreset: 0, overlayEnabled: false })).toEqual({
      resolutionScale: 0.85,
      qualityPreset: 0,
      overlayEnabled: false,
    });
  });

  it('rejects unknown scales', () => {
    expect(parseGovernorTier({ resolutionScale: 0.5 })).toBeUndefined();
  });
});

describe('constants', () => {
  it('keeps hysteresis gap between down and up thresholds', () => {
    expect(DOWN_P75_MS).toBeGreaterThan(UP_P75_MS);
    expect(UP_HOLD_MS).toBeGreaterThan(SAMPLE_WINDOW_MS);
  });
});
