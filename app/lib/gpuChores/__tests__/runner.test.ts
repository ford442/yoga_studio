import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getChoreBreadcrumbs, getChoresStatus, resetChoreBreadcrumbs } from '../breadcrumbs';
import { GPU_BREAK_EVEN_PIXELS } from '../policy';
import { runDownsample2d, runLumaHistogram, runLutU8Map } from '../runner';
import type { GpuChoreExecutor, Rgba8Image } from '../types';

const image = (width: number, height: number): Rgba8Image => ({
  data: new Uint8ClampedArray(width * height * 4).fill(255),
  width,
  height,
});

/** GPU_BREAK_EVEN_PIXELS is 512*512, so this clears the bar. */
const large = () => image(1024, 512);
const small = () => image(8, 8);

const fakeExecutor = (overrides: Partial<GpuChoreExecutor> = {}): GpuChoreExecutor => ({
  isAvailable: () => true,
  lumaHistogram: vi.fn(async () => ({ bins: new Uint32Array(256), total: 1, meanLuma: 0.5 })),
  downsample: vi.fn(async () => image(2, 2)),
  lutMap: vi.fn(async () => image(2, 2)),
  ...overrides,
});

beforeEach(() => {
  resetChoreBreadcrumbs();
  vi.restoreAllMocks();
});

describe('runLumaHistogram', () => {
  it('runs on the lent device once past break-even', async () => {
    const executor = fakeExecutor();
    const result = await runLumaHistogram(large(), { executor, gpuComputeDisabled: false });

    expect(result.backend).toBe('webgpu');
    expect(result.fellBack).toBe(false);
    expect(result.value.meanLuma).toBe(0.5);
    expect(executor.lumaHistogram).toHaveBeenCalledOnce();
  });

  it('computes on the CPU when no device is on loan', async () => {
    const executor = fakeExecutor({ isAvailable: () => false });
    // `wasm: null` pins this to the scalar tier: without it the native kernels
    // would take the job, which is covered separately below.
    const result = await runLumaHistogram(small(), { executor, gpuComputeDisabled: false, wasm: null });

    expect(result.backend).toBe('js');
    expect(result.value.bins[255]).toBe(64);
    expect(executor.lumaHistogram).not.toHaveBeenCalled();
  });

  it('falls back to the CPU tier when the WebGPU chore throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const executor = fakeExecutor({
      lumaHistogram: vi.fn(async () => {
        throw new Error('device lost');
      }),
    });
    const result = await runLumaHistogram(large(), { executor, gpuComputeDisabled: false, wasm: null });

    expect(result.backend).toBe('js');
    expect(result.fellBack).toBe(true);
    expect(result.reason).toMatch(/device lost/);
    expect(result.value.total).toBe(1024 * 512);
  });
});

describe('runDownsample2d', () => {
  it('dispatches large plates to the GPU tier', async () => {
    const executor = fakeExecutor();
    const result = await runDownsample2d(large(), 2, 2, { executor, gpuComputeDisabled: false });

    expect(result.backend).toBe('webgpu');
    expect(executor.downsample).toHaveBeenCalledWith(expect.anything(), 2, 2);
  });

  it('keeps small images on the CPU tier below break-even', async () => {
    const result = await runDownsample2d(small(), 2, 2, {
      executor: fakeExecutor(),
      gpuComputeDisabled: false,
      canvas2d: false,
      wasm: null,
    });

    expect(result.backend).toBe('js');
    expect(result.value.width).toBe(2);
    expect(result.reason).toContain('break-even');
    expect(GPU_BREAK_EVEN_PIXELS).toBe(512 * 512);
  });
});

describe('runLutU8Map', () => {
  it('honours the kill switch even with a live device', async () => {
    const executor = fakeExecutor();
    const lut = new Uint8Array(256).fill(7);
    const result = await runLutU8Map(large(), lut, { executor, gpuComputeDisabled: true, wasm: null });

    expect(result.backend).toBe('js');
    expect(result.reason).toMatch(/kill switch/);
    expect(result.value.data[0]).toBe(7);
    expect(executor.lutMap).not.toHaveBeenCalled();
  });

  it('runs on the GPU tier when nothing blocks it', async () => {
    const executor = fakeExecutor();
    const result = await runLutU8Map(large(), new Uint8Array(256), { executor, gpuComputeDisabled: false });

    expect(result.backend).toBe('webgpu');
    expect(executor.lutMap).toHaveBeenCalledOnce();
  });
});

describe('breadcrumbs', () => {
  it('records the backend and reason of every chore', async () => {
    await runLumaHistogram(small(), { gpuComputeDisabled: false, wasm: null });
    await runDownsample2d(small(), 2, 2, { gpuComputeDisabled: true, canvas2d: false, wasm: null });

    const crumbs = getChoreBreadcrumbs();
    expect(crumbs).toHaveLength(2);
    expect(crumbs[0].job).toBe('luma_histogram_bt709');
    expect(crumbs[1].job).toBe('downsample_2d');
    expect(getChoresStatus()).toMatchObject({ backend: 'js', jobCount: 2 });
  });

  it('notes the GPU error on a fallback crumb and publishes it on window', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const executor = fakeExecutor({
      downsample: vi.fn(async () => {
        throw new Error('pipeline validation');
      }),
    });
    await runDownsample2d(large(), 4, 4, { executor, gpuComputeDisabled: false, canvas2d: false, wasm: null });

    expect(getChoreBreadcrumbs()[0].gpuError).toBe('pipeline validation');
    expect(getChoresStatus().reason).toMatch(/fell back/);
    expect(
      (window as Window & { gpuChores?: { breadcrumbs: unknown[] } }).gpuChores?.breadcrumbs,
    ).toHaveLength(1);
  });

  it('caps the breadcrumb ring', async () => {
    for (let i = 0; i < 22; i += 1) {
      await runLumaHistogram(small(), { gpuComputeDisabled: true, wasm: null });
    }
    expect(getChoreBreadcrumbs()).toHaveLength(20);
    expect(getChoresStatus().jobCount).toBe(22);
  });
});

describe('the WASM tier', () => {
  it('takes every job below break-even, ahead of Canvas2D and JS', async () => {
    const executor = fakeExecutor({ isAvailable: () => false });

    const histogram = await runLumaHistogram(small(), { executor, gpuComputeDisabled: false });
    expect(histogram.backend).toBe('wasm');
    expect(histogram.value.bins[255]).toBe(64);

    // Canvas2D is available here and still loses: the native kernel is the
    // bit-exact area average, `drawImage` is the browser's own filter.
    const thumb = await runDownsample2d(small(), 2, 2, {
      executor,
      gpuComputeDisabled: false,
      canvas2d: true,
    });
    expect(thumb.backend).toBe('wasm');
    expect(thumb.value.width).toBe(2);

    const graded = await runLutU8Map(small(), new Uint8Array(256).fill(7), { gpuComputeDisabled: true });
    expect(graded.backend).toBe('wasm');
    expect(graded.value.data[0]).toBe(7);
    expect(graded.value.data[3]).toBe(255); // alpha passes through
  });

  it('is still outranked by a lent device past break-even', async () => {
    const executor = fakeExecutor();
    const result = await runLumaHistogram(large(), { executor, gpuComputeDisabled: false });

    expect(result.backend).toBe('webgpu');
  });

  it('catches the WebGPU fallback before Canvas2D does', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const executor = fakeExecutor({
      downsample: vi.fn(async () => {
        throw new Error('device lost');
      }),
    });
    const result = await runDownsample2d(large(), 4, 4, { executor, gpuComputeDisabled: false });

    expect(result.backend).toBe('wasm');
    expect(result.fellBack).toBe(true);
    expect(result.reason).toMatch(/device lost/);
  });

  it('breadcrumbs why a job dropped to Canvas2D or JS instead', async () => {
    await runDownsample2d(small(), 2, 2, { gpuComputeDisabled: true, canvas2d: true, wasm: null });

    const crumb = getChoreBreadcrumbs()[0];
    expect(crumb.backend).toBe('canvas');
    expect(crumb.reason).toMatch(/wasm tier disabled by caller/);
    expect(getChoresStatus().backend).toBe('canvas');
  });
});
