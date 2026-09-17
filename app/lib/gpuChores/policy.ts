import type { ChoreJobKind, ChoresBackend, ChoresDecision } from './types';

/**
 * Below this, dispatch + readback costs more than the scalar loop, so small
 * poster images stay on Canvas2D. 512x512 measured on the background plates.
 */
export const GPU_BREAK_EVEN_PIXELS = 512 * 512;

export interface ChorePolicyInput {
  job: ChoreJobKind;
  /** Source pixel count (width * height). */
  pixels: number;
  /** True only when the renderer is lending a live GPUDevice. */
  hasDevice: boolean;
  /** `?no_gpu_compute` or the settings-equivalent. */
  gpuComputeDisabled: boolean;
  hasCanvas2d: boolean;
  /** True when the native kernels instantiated (SIMD present, CSP permitting). */
  hasWasm: boolean;
}

/**
 * The CPU tier for a job: WASM SIMD first, then Canvas2D where it helps, then
 * the scalar loop.
 *
 * WASM outranks Canvas2D even for downsample. `drawImage` is fast, but it is
 * the *browser's* filter rather than the area average the kit specifies, so it
 * only agrees with the goldens approximately; the native kernel is bit-exact
 * with `cpuJobs.ts` and needs no canvas round trip on either side.
 */
export function cpuBackendFor(
  job: ChoreJobKind,
  hasCanvas2d: boolean,
  hasWasm: boolean,
): ChoresBackend {
  if (hasWasm) return 'wasm';
  // Only downsample gets a real win from Canvas2D (`drawImage` box filter);
  // histogram and LUT would still need a getImageData round trip either way.
  return job === 'downsample_2d' && hasCanvas2d ? 'canvas' : 'js';
}

/**
 * Pick a backend without ever asking for a second adapter: WebGPU is available
 * only if the renderer (and its device-recovery singleton) is lending a device.
 */
export function selectChoresBackend(input: ChorePolicyInput): ChoresDecision {
  const cpu = cpuBackendFor(input.job, input.hasCanvas2d, input.hasWasm);
  if (input.gpuComputeDisabled) {
    return { backend: cpu, reason: 'GPU compute disabled (kill switch)' };
  }
  if (!input.hasDevice) {
    return { backend: cpu, reason: 'no renderer GPUDevice on loan' };
  }
  if (input.pixels < GPU_BREAK_EVEN_PIXELS) {
    return { backend: cpu, reason: `below GPU break-even (${input.pixels} px)` };
  }
  return { backend: 'webgpu', reason: 'adopted renderer GPUDevice' };
}
