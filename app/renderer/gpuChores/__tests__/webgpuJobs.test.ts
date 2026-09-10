import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWebGpuChoreExecutor } from '../webgpuJobs';
import type { Rgba8Image } from '../../../lib/gpuChores';

/**
 * A fake device just real enough to exercise dispatch shapes, readback padding
 * and pipeline caching. Real WebGPU behaviour is covered by the e2e run.
 */
interface FakeGpu {
  device: GPUDevice;
  readbacks: Uint8Array[];
  dispatches: Array<[number, number]>;
  shaderCode: string[];
  pipelineCount: number;
  writtenTextures: number;
  externalCopies: number;
  destroyed: number;
}

const createFakeGpu = (payload: (size: number) => Uint8Array): FakeGpu => {
  const state: FakeGpu = {
    device: null as unknown as GPUDevice,
    readbacks: [],
    dispatches: [],
    shaderCode: [],
    pipelineCount: 0,
    writtenTextures: 0,
    externalCopies: 0,
    destroyed: 0,
  };

  const encoder = {
    beginComputePass: () => ({
      setPipeline: vi.fn(),
      setBindGroup: vi.fn(),
      dispatchWorkgroups: (x: number, y: number) => state.dispatches.push([x, y]),
      end: vi.fn(),
    }),
    copyBufferToBuffer: vi.fn(),
    copyTextureToBuffer: vi.fn(),
    finish: () => ({}),
  };

  const device = {
    pushErrorScope: vi.fn(),
    popErrorScope: async () => null,
    createShaderModule: ({ code }: { code: string }) => {
      state.shaderCode.push(code);
      return {};
    },
    createComputePipelineAsync: async () => {
      state.pipelineCount += 1;
      return { getBindGroupLayout: () => ({}) };
    },
    createTexture: () => ({ createView: () => ({}), destroy: () => { state.destroyed += 1; } }),
    createBuffer: ({ size }: { size: number }) => {
      const bytes = payload(size);
      state.readbacks.push(bytes);
      return {
        size,
        destroy: () => { state.destroyed += 1; },
        mapAsync: async () => {},
        getMappedRange: () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + size),
        unmap: vi.fn(),
      };
    },
    createBindGroup: vi.fn(),
    createCommandEncoder: () => encoder,
    queue: {
      writeBuffer: vi.fn(),
      writeTexture: () => { state.writtenTextures += 1; },
      copyExternalImageToTexture: () => { state.externalCopies += 1; },
      submit: vi.fn(),
    },
  } as unknown as GPUDevice;

  state.device = device;
  return state;
};

const image = (width: number, height: number): Rgba8Image => ({
  data: new Uint8ClampedArray(width * height * 4),
  width,
  height,
});

beforeEach(() => {
  Object.assign(globalThis, {
    GPUBufferUsage: { STORAGE: 1, COPY_SRC: 2, COPY_DST: 4, MAP_READ: 8, UNIFORM: 16 },
    GPUTextureUsage: { TEXTURE_BINDING: 1, COPY_DST: 2, RENDER_ATTACHMENT: 4, STORAGE_BINDING: 8, COPY_SRC: 16 },
    GPUMapMode: { READ: 1 },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('luma_histogram_bt709 on WebGPU', () => {
  it('reads back 256 bins and derives the mean luma from them', async () => {
    const bins = new Uint32Array(256);
    bins[128] = 16;
    const gpu = createFakeGpu(() => new Uint8Array(bins.buffer.slice(0)));
    const executor = createWebGpuChoreExecutor(() => gpu.device);

    const result = await executor.lumaHistogram(image(4, 4));

    expect(result.bins[128]).toBe(16);
    expect(result.total).toBe(16);
    expect(result.meanLuma).toBeCloseTo(128 / 255, 6);
  });

  it('dispatches one (8,8) workgroup per tile and uploads packed bytes', async () => {
    const gpu = createFakeGpu((size) => new Uint8Array(size));
    const executor = createWebGpuChoreExecutor(() => gpu.device);

    await executor.lumaHistogram(image(17, 9));

    expect(gpu.dispatches).toEqual([[3, 2]]);
    expect(gpu.writtenTextures).toBe(1);
    expect(gpu.externalCopies).toBe(0);
    expect(gpu.shaderCode[0]).toContain('workgroup_size(8, 8)');
    expect(gpu.shaderCode[0]).toContain('0.2126');
  });

  it('uploads an external image source through copyExternalImageToTexture', async () => {
    const gpu = createFakeGpu((size) => new Uint8Array(size));
    const executor = createWebGpuChoreExecutor(() => gpu.device);
    const bitmap = { width: 8, height: 8 } as unknown as ImageBitmap;

    await executor.lumaHistogram(bitmap);

    expect(gpu.externalCopies).toBe(1);
    expect(gpu.writtenTextures).toBe(0);
  });

  it('compiles each chore pipeline once per device', async () => {
    const gpu = createFakeGpu((size) => new Uint8Array(size));
    const executor = createWebGpuChoreExecutor(() => gpu.device);

    await executor.lumaHistogram(image(4, 4));
    await executor.lumaHistogram(image(4, 4));

    expect(gpu.pipelineCount).toBe(1);
  });
});

describe('downsample_2d on WebGPU', () => {
  it('strips the 256-byte row padding out of the readback', async () => {
    const gpu = createFakeGpu((size) => {
      const bytes = new Uint8Array(size);
      // Two rows of two pixels, each row padded out to 256 bytes.
      if (size < 512) return bytes;
      bytes.set([1, 2, 3, 4, 5, 6, 7, 8], 0);
      bytes.set([9, 10, 11, 12, 13, 14, 15, 16], 256);
      return bytes;
    });
    const executor = createWebGpuChoreExecutor(() => gpu.device);

    const thumb = await executor.downsample(image(1024, 512), 2, 2);

    expect(thumb.width).toBe(2);
    expect(thumb.height).toBe(2);
    expect(Array.from(thumb.data)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    expect(gpu.dispatches).toEqual([[1, 1]]);
  });
});

describe('lut_u8_map on WebGPU', () => {
  it('rejects a LUT that is not 256 entries', async () => {
    const gpu = createFakeGpu((size) => new Uint8Array(size));
    const executor = createWebGpuChoreExecutor(() => gpu.device);

    await expect(executor.lutMap(image(4, 4), new Uint8Array(4))).rejects.toThrow(/256-entry/);
  });

  it('maps every channel through the packed LUT words', async () => {
    const gpu = createFakeGpu((size) => new Uint8Array(size).fill(3));
    const executor = createWebGpuChoreExecutor(() => gpu.device);

    const mapped = await executor.lutMap(image(2, 2), new Uint8Array(256));

    expect(mapped.width).toBe(2);
    expect(gpu.shaderCode[0]).toContain('array<u32, 64>');
    expect(Array.from(mapped.data.slice(0, 4))).toEqual([3, 3, 3, 3]);
  });
});
