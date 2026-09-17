import type { PerformanceMode } from '../types/renderer';

/**
 * The single source of truth for how the renderer talks to WebGPU/WebGL2 at
 * boot: adapter selection, the device's requested features/limits, canvas
 * configuration, and the WebGL2 fallback's matching context options. Nothing
 * here requests a second adapter or device — gpu-chores borrows whatever the
 * renderer already holds (see `gpuChores/choreDevice.ts`).
 */

/**
 * App `performance` mode means "save battery", which WebGPU spells
 * `low-power`; `auto` and `quality` both ask for the fastest adapter
 * available. `featureLevel: 'core'` is explicit so a browser default change
 * can't silently drop us into `compatibility` mode.
 */
export function getWebGPUAdapterOptions(mode: PerformanceMode): GPURequestAdapterOptions {
  return {
    powerPreference: mode === 'performance' ? 'low-power' : 'high-performance',
    forceFallbackAdapter: false,
  };
}

const DEFAULT_DEVICE_LABEL = 'Sacred Breath WebGPU Device';

/** Requested only if the adapter actually supports it; unlocks the GPU timestamp governor follow-up. */
const OPTIONAL_FEATURES: GPUFeatureName[] = ['timestamp-query'];

/**
 * Limits gpu-chores' compute pipelines exercise (storage textures/buffers,
 * atomics on `HISTOGRAM_BINS`-sized arrays). Requested at the adapter's own
 * reported ceiling so device creation can never fail from an over-ask.
 */
const CHORE_LIMIT_KEYS = [
  'maxComputeInvocationsPerWorkgroup',
  'maxComputeWorkgroupSizeX',
  'maxComputeWorkgroupSizeY',
  'maxStorageBuffersPerShaderStage',
  'maxStorageTexturesPerShaderStage',
  'maxBufferSize',
] as const satisfies readonly (keyof GPUSupportedLimits)[];

/** Adapter features gpu-chores/renderer will actually request, given what this adapter supports. */
export function resolveRequiredFeatures(adapter: GPUAdapter): GPUFeatureName[] {
  return OPTIONAL_FEATURES.filter((feature) => adapter.features.has(feature));
}

/** Compute limits gpu-chores depends on, read from the adapter rather than assumed. */
export function resolveRequiredLimits(adapter: GPUAdapter): Record<string, number> {
  const limits: Record<string, number> = {};
  for (const key of CHORE_LIMIT_KEYS) {
    const value = adapter.limits[key];
    if (typeof value === 'number') limits[key] = value;
  }
  return limits;
}

/** Build the `requestDevice` descriptor: probed features/limits, never a blind empty request. */
export function buildGpuDeviceDescriptor(
  adapter: GPUAdapter,
  label: string = DEFAULT_DEVICE_LABEL,
): GPUDeviceDescriptor {
  return {
    label,
    requiredFeatures: resolveRequiredFeatures(adapter),
    requiredLimits: resolveRequiredLimits(adapter),
  };
}

/** Canvas color space kept at sRGB, matching the CSS stack (environment plates, instructor video); `display-p3` is a future quality-mode flag. */
export const GPU_CANVAS_COLOR_SPACE: PredefinedColorSpace = 'srgb';

/** Explicit canvas configuration; every option `context.configure` accepts is set, not defaulted. */
export function buildGpuCanvasConfiguration(
  device: GPUDevice,
  format: GPUTextureFormat,
): GPUCanvasConfiguration {
  return {
    device,
    format,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
    alphaMode: 'premultiplied',
    colorSpace: GPU_CANVAS_COLOR_SPACE,
    viewFormats: [],
    toneMapping: { mode: 'standard' },
  };
}

/** WebGL2 fallback context options mirroring the WebGPU canvas's alpha/premultiply contract and power preference. */
export function getWebGL2ContextOptions(mode: PerformanceMode): WebGLContextAttributes {
  return {
    alpha: true,
    antialias: mode !== 'performance',
    premultipliedAlpha: true,
    powerPreference: mode === 'performance' ? 'low-power' : 'high-performance',
    desynchronized: true,
    failIfMajorPerformanceCaveat: false,
  };
}
