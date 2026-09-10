import { recordChoreBreadcrumb } from './breadcrumbs';
import {
  downsample2dCanvas,
  downsample2dCpu,
  hasCanvas2d,
  imageSize,
  lumaHistogramCpu,
  lutU8MapCpu,
} from './cpuJobs';
import { isGpuComputeDisabled } from './flags';
import { selectChoresBackend } from './policy';
import type {
  ChoreImageSource,
  ChoreJobKind,
  ChoreResult,
  ChoresBackend,
  GpuChoreExecutor,
  HistogramResult,
  Rgba8Image,
} from './types';

export interface ChoreRunOptions {
  /** WebGPU half of the kit. Absent (or unavailable) means CPU tiers only. */
  executor?: GpuChoreExecutor | null;
  /** Overrides the URL/settings kill switch; mostly a test seam. */
  gpuComputeDisabled?: boolean;
  /** Overrides Canvas2D detection; mostly a test seam. */
  canvas2d?: boolean;
}

const now = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

async function run<T>(
  job: ChoreJobKind,
  source: ChoreImageSource,
  options: ChoreRunOptions,
  gpu: (executor: GpuChoreExecutor) => Promise<T>,
  cpu: (backend: ChoresBackend) => T,
): Promise<ChoreResult<T>> {
  const { width, height } = imageSize(source);
  const pixels = width * height;
  const canvas2d = options.canvas2d ?? hasCanvas2d();
  const executor = options.executor ?? null;
  const decision = selectChoresBackend({
    job,
    pixels,
    hasDevice: Boolean(executor?.isAvailable()),
    gpuComputeDisabled: options.gpuComputeDisabled ?? isGpuComputeDisabled(),
    hasCanvas2d: canvas2d,
  });

  const started = now();
  if (decision.backend === 'webgpu' && executor) {
    try {
      const value = await gpu(executor);
      const durationMs = now() - started;
      recordChoreBreadcrumb({ job, backend: 'webgpu', reason: decision.reason, pixels, durationMs, timestamp: Date.now() });
      return { value, backend: 'webgpu', reason: decision.reason, durationMs, fellBack: false };
    } catch (error) {
      // A WebGPU failure in Chrome or Edge must land on the Canvas/JS helpers
      // rather than take the studio down with it.
      const gpuError = error instanceof Error ? error.message : String(error);
      console.warn(`[gpu-chores] ${job} fell back to CPU:`, gpuError);
      const backend = selectChoresBackend({
        job,
        pixels,
        hasDevice: false,
        gpuComputeDisabled: true,
        hasCanvas2d: canvas2d,
      }).backend;
      const value = cpu(backend);
      const durationMs = now() - started;
      const reason = `WebGPU chore failed (${gpuError})`;
      recordChoreBreadcrumb({ job, backend, reason: decision.reason, pixels, durationMs, gpuError, timestamp: Date.now() });
      return { value, backend, reason, durationMs, fellBack: true };
    }
  }

  const value = cpu(decision.backend);
  const durationMs = now() - started;
  recordChoreBreadcrumb({ job, backend: decision.backend, reason: decision.reason, pixels, durationMs, timestamp: Date.now() });
  return { value, backend: decision.backend, reason: decision.reason, durationMs, fellBack: false };
}

export function runLumaHistogram(
  source: ChoreImageSource,
  options: ChoreRunOptions = {},
): Promise<ChoreResult<HistogramResult>> {
  return run(
    'luma_histogram_bt709',
    source,
    options,
    (executor) => executor.lumaHistogram(source),
    () => lumaHistogramCpu(source),
  );
}

export function runDownsample2d(
  source: ChoreImageSource,
  width: number,
  height: number,
  options: ChoreRunOptions = {},
): Promise<ChoreResult<Rgba8Image>> {
  return run(
    'downsample_2d',
    source,
    options,
    (executor) => executor.downsample(source, width, height),
    (backend) =>
      backend === 'canvas'
        ? downsample2dCanvas(source, width, height)
        : downsample2dCpu(source, width, height),
  );
}

export function runLutU8Map(
  source: ChoreImageSource,
  lut: Uint8Array,
  options: ChoreRunOptions = {},
): Promise<ChoreResult<Rgba8Image>> {
  return run(
    'lut_u8_map',
    source,
    options,
    (executor) => executor.lutMap(source, lut),
    () => lutU8MapCpu(source, lut),
  );
}
