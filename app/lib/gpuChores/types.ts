/**
 * Shared types for gpu-chores: small, content-agnostic image helpers (histogram,
 * downsample, LUT) that the studio can run without any FX module owning a device.
 *
 * Studio-specific WGSL (the sacred-* shaders) stays local to `public/` — nothing
 * here knows about breath, mandalas, or the practice screen.
 */

/** Tightly packed RGBA8 pixels (no row padding). */
export interface Rgba8Image {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Anything a chore can read pixels from. */
export type ChoreImageSource = Rgba8Image | ImageBitmap | HTMLCanvasElement | OffscreenCanvas;

export type ChoreJobKind = 'luma_histogram_bt709' | 'downsample_2d' | 'lut_u8_map';

/**
 * Where a chore ran. `wasm` is the native mid-tier (`native/gpu-chores-wasm`),
 * `canvas` is Canvas2D — useful for downsample only, since a histogram or LUT
 * would still need a `getImageData` round trip — and `js` is the scalar loop of
 * last resort and the correctness reference for every other tier.
 */
export type ChoresBackend = 'webgpu' | 'wasm' | 'canvas' | 'js';

export interface ChoresDecision {
  backend: ChoresBackend;
  /** Human-readable why, surfaced in the diagnostics panel. */
  reason: string;
}

export const HISTOGRAM_BINS = 256;

export interface HistogramResult {
  /** 256 BT.709 luma bins over the sRGB-encoded pixel values. */
  bins: Uint32Array;
  /** Pixels counted (width * height). */
  total: number;
  /** Mean luma in 0..1. */
  meanLuma: number;
}

export interface ChoreResult<T> {
  value: T;
  backend: ChoresBackend;
  reason: string;
  durationMs: number;
  /** True when the WebGPU path was chosen but threw, and a CPU tier finished the job. */
  fellBack: boolean;
}

/** The WebGPU half of the kit, injected so `app/lib` never imports a renderer module. */
export interface GpuChoreExecutor {
  /** False whenever the renderer has no live device to lend (never requests its own). */
  isAvailable(): boolean;
  lumaHistogram(source: ChoreImageSource): Promise<HistogramResult>;
  downsample(source: ChoreImageSource, width: number, height: number): Promise<Rgba8Image>;
  lutMap(source: ChoreImageSource, lut: Uint8Array): Promise<Rgba8Image>;
}
