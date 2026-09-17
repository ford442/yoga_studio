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
import { loadChoresWasm, type ChoresWasm } from './wasm/choresModule';
import { downsample2dWasm, lumaHistogramWasm, lutU8MapWasm } from './wasmJobs';
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
  /**
   * Overrides the native kernels: a module to use, or `null` to pretend the
   * WASM tier is unavailable. Mostly a test seam.
   */
  wasm?: ChoresWasm | null;
}

const now = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

/** What each tier below WebGPU can do for one job. */
interface CpuTiers<T> {
  wasm: (wasm: ChoresWasm) => T;
  /** Canvas2D where the job has one, otherwise the scalar loop. */
  fallback: (backend: ChoresBackend) => T;
}

async function resolveWasm(
  options: ChoreRunOptions,
): Promise<{ wasm: ChoresWasm | null; reason: string }> {
  // An explicit `null` means "act as if there is no WASM tier" — the test seam
  // for the CSP / no-SIMD path, and `undefined` still means "load it".
  if (options.wasm !== undefined) {
    return { wasm: options.wasm, reason: options.wasm ? '' : 'wasm tier disabled by caller' };
  }
  const load = await loadChoresWasm();
  return { wasm: load.module, reason: load.reason };
}

/**
 * Run the chosen CPU-side tier, degrading once if the native kernel throws.
 *
 * A WASM failure here is not the instantiation failure the loader already
 * handles — it is a bad status or a refused arena growth on a huge plate — so
 * it drops this one job to Canvas2D/JS rather than poisoning the module.
 */
function runCpu<T>(
  backend: ChoresBackend,
  wasm: ChoresWasm | null,
  tiers: CpuTiers<T>,
  job: ChoreJobKind,
  canvas2d: boolean,
): { value: T; backend: ChoresBackend; note: string } {
  if (backend === 'wasm' && wasm) {
    try {
      return { value: tiers.wasm(wasm), backend: 'wasm', note: '' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[gpu-chores] ${job} fell back from wasm:`, message);
      const next = selectChoresBackend({
        job,
        pixels: 0,
        hasDevice: false,
        gpuComputeDisabled: true,
        hasCanvas2d: canvas2d,
        hasWasm: false,
      }).backend;
      return { value: tiers.fallback(next), backend: next, note: `wasm job failed (${message})` };
    }
  }
  return { value: tiers.fallback(backend), backend, note: '' };
}

async function run<T>(
  job: ChoreJobKind,
  source: ChoreImageSource,
  options: ChoreRunOptions,
  gpu: (executor: GpuChoreExecutor) => Promise<T>,
  tiers: CpuTiers<T>,
): Promise<ChoreResult<T>> {
  const { width, height } = imageSize(source);
  const pixels = width * height;
  const canvas2d = options.canvas2d ?? hasCanvas2d();
  const executor = options.executor ?? null;

  // Resolved before the decision, not after, so the very first chore of a
  // session already reports the tier it actually ran on. The module is a few KB
  // and inlined, so this settles well inside a frame, and only ever once.
  const { wasm, reason: wasmReason } = await resolveWasm(options);

  const decision = selectChoresBackend({
    job,
    pixels,
    hasDevice: Boolean(executor?.isAvailable()),
    gpuComputeDisabled: options.gpuComputeDisabled ?? isGpuComputeDisabled(),
    hasCanvas2d: canvas2d,
    hasWasm: wasm !== null,
  });
  // The breadcrumb should say *why* a job landed on Canvas2D or JS when the
  // WASM tier was expected to take it.
  const withWasm = (reason: string): string => (wasmReason ? `${reason} · ${wasmReason}` : reason);

  const started = now();
  if (decision.backend === 'webgpu' && executor) {
    try {
      const value = await gpu(executor);
      const durationMs = now() - started;
      const reason = decision.reason;
      recordChoreBreadcrumb({ job, backend: 'webgpu', reason, pixels, durationMs, timestamp: Date.now() });
      return { value, backend: 'webgpu', reason, durationMs, fellBack: false };
    } catch (error) {
      // A WebGPU failure in Chrome or Edge must land on the WASM/Canvas/JS
      // helpers rather than take the studio down with it.
      const gpuError = error instanceof Error ? error.message : String(error);
      console.warn(`[gpu-chores] ${job} fell back to CPU:`, gpuError);
      const cpuBackend = selectChoresBackend({
        job,
        pixels,
        hasDevice: false,
        gpuComputeDisabled: true,
        hasCanvas2d: canvas2d,
        hasWasm: wasm !== null,
      }).backend;
      const ran = runCpu(cpuBackend, wasm, tiers, job, canvas2d);
      const durationMs = now() - started;
      const reason = withWasm(`WebGPU chore failed (${gpuError})`);
      recordChoreBreadcrumb({ job, backend: ran.backend, reason: decision.reason, pixels, durationMs, gpuError, timestamp: Date.now() });
      return { value: ran.value, backend: ran.backend, reason, durationMs, fellBack: true };
    }
  }

  const ran = runCpu(decision.backend, wasm, tiers, job, canvas2d);
  const durationMs = now() - started;
  const reason = withWasm(ran.note ? `${decision.reason} · ${ran.note}` : decision.reason);
  recordChoreBreadcrumb({ job, backend: ran.backend, reason, pixels, durationMs, timestamp: Date.now() });
  return { value: ran.value, backend: ran.backend, reason, durationMs, fellBack: false };
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
    {
      wasm: (wasm) => lumaHistogramWasm(wasm, source),
      fallback: () => lumaHistogramCpu(source),
    },
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
    {
      wasm: (wasm) => downsample2dWasm(wasm, source, width, height),
      fallback: (backend) =>
        backend === 'canvas'
          ? downsample2dCanvas(source, width, height)
          : downsample2dCpu(source, width, height),
    },
  );
}

/**
 * 256-entry grade over R/G/B.
 *
 * No production caller yet — the GPU media compositor is the intended one, and
 * this tier exists so a 1920x1080 LUT pass does not have to be a scalar JS loop
 * on the breath rAF when it lands. Until then it is covered by the unit tests
 * and the host C++ goldens only. See docs/gpu-chores.md, "Jobs".
 */
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
    {
      wasm: (wasm) => lutU8MapWasm(wasm, source, lut),
      fallback: () => lutU8MapCpu(source, lut),
    },
  );
}
