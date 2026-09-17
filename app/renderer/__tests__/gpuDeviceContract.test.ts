import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildGpuCanvasConfiguration,
  buildGpuDeviceDescriptor,
  getWebGL2ContextOptions,
  getWebGPUAdapterOptions,
  GPU_CANVAS_COLOR_SPACE,
  resolveRequiredFeatures,
  resolveRequiredLimits,
} from '../gpuDeviceContract';

function makeAdapter(features: string[], limits: Record<string, number>): GPUAdapter {
  return {
    features: new Set(features) as unknown as GPUSupportedFeatures,
    limits: limits as unknown as GPUSupportedLimits,
  } as unknown as GPUAdapter;
}

describe('getWebGPUAdapterOptions', () => {
  it.each([
    ['performance', 'low-power'],
    ['auto', 'high-performance'],
    ['quality', 'high-performance'],
  ] as const)('maps %s mode to %s (battery saver = low-power)', (mode, powerPreference) => {
    expect(getWebGPUAdapterOptions(mode)).toEqual({
      powerPreference,
      forceFallbackAdapter: false,
    });
  });
});

describe('resolveRequiredFeatures', () => {
  it('requests timestamp-query only when the adapter reports it', () => {
    expect(resolveRequiredFeatures(makeAdapter(['timestamp-query'], {}))).toEqual(['timestamp-query']);
    expect(resolveRequiredFeatures(makeAdapter([], {}))).toEqual([]);
  });
});

describe('resolveRequiredLimits', () => {
  it('pulls only the gpu-chores compute limits the adapter reports', () => {
    const adapter = makeAdapter([], {
      maxComputeInvocationsPerWorkgroup: 256,
      maxComputeWorkgroupSizeX: 256,
      maxComputeWorkgroupSizeY: 256,
      maxStorageBuffersPerShaderStage: 8,
      maxStorageTexturesPerShaderStage: 4,
      maxBufferSize: 268435456,
      maxTextureDimension2D: 8192,
    });
    expect(resolveRequiredLimits(adapter)).toEqual({
      maxComputeInvocationsPerWorkgroup: 256,
      maxComputeWorkgroupSizeX: 256,
      maxComputeWorkgroupSizeY: 256,
      maxStorageBuffersPerShaderStage: 8,
      maxStorageTexturesPerShaderStage: 4,
      maxBufferSize: 268435456,
    });
  });

  it('omits a limit the adapter does not report', () => {
    expect(resolveRequiredLimits(makeAdapter([], { maxBufferSize: 100 }))).toEqual({ maxBufferSize: 100 });
  });
});

describe('buildGpuDeviceDescriptor', () => {
  it('never requests an empty object; probes the adapter instead', () => {
    const adapter = makeAdapter(['timestamp-query'], { maxBufferSize: 100 });
    expect(buildGpuDeviceDescriptor(adapter, 'Test Device')).toEqual({
      label: 'Test Device',
      requiredFeatures: ['timestamp-query'],
      requiredLimits: { maxBufferSize: 100 },
    });
  });

  it('defaults the label when none is given', () => {
    const descriptor = buildGpuDeviceDescriptor(makeAdapter([], {}));
    expect(descriptor.label).toBe('Sacred Breath WebGPU Device');
  });
});

describe('buildGpuCanvasConfiguration', () => {
  beforeEach(() => {
    vi.stubGlobal('GPUTextureUsage', { RENDER_ATTACHMENT: 0x10 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets usage, alphaMode, colorSpace, and toneMapping explicitly', () => {
    const device = {} as GPUDevice;
    const config = buildGpuCanvasConfiguration(device, 'bgra8unorm');
    expect(config).toEqual({
      device,
      format: 'bgra8unorm',
      usage: 0x10,
      alphaMode: 'premultiplied',
      colorSpace: GPU_CANVAS_COLOR_SPACE,
      viewFormats: [],
      toneMapping: { mode: 'standard' },
    });
    expect(GPU_CANVAS_COLOR_SPACE).toBe('srgb');
  });
});

describe('getWebGL2ContextOptions', () => {
  it('matches the WebGPU canvas alpha/premultiply contract and disables antialiasing in performance mode', () => {
    expect(getWebGL2ContextOptions('performance')).toEqual({
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      powerPreference: 'low-power',
      desynchronized: true,
      failIfMajorPerformanceCaveat: false,
    });
  });

  it.each(['auto', 'quality'] as const)('keeps antialiasing and requests high-performance for %s mode', (mode) => {
    expect(getWebGL2ContextOptions(mode)).toEqual({
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
      desynchronized: true,
      failIfMajorPerformanceCaveat: false,
    });
  });
});
