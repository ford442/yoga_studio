import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RendererBackendContext } from '../types';
import { normalizeCompilationMessages, WebGPUBackend } from '../webgpuBackend';

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

function makeDevice(messages: Array<Partial<GPUCompilationMessage>> = []) {
  const lost = deferred<GPUDeviceLostInfo>();
  const shaderModule = {
    getCompilationInfo: vi.fn(async () => ({ messages })),
  };
  const device = {
    lost: lost.promise,
    destroy: vi.fn(),
    createShaderModule: vi.fn(() => shaderModule),
    createRenderPipeline: vi.fn(() => ({ getBindGroupLayout: vi.fn(() => ({})) })),
    createBuffer: vi.fn(() => ({})),
    createBindGroup: vi.fn(() => ({})),
    createCommandEncoder: vi.fn(),
    queue: { writeBuffer: vi.fn(), submit: vi.fn() },
  };
  return { device: device as unknown as GPUDevice, lost, shaderModule };
}

function makeContext(canvas: HTMLCanvasElement): RendererBackendContext {
  return {
    canvas,
    container: document.createElement('div'),
    overlay: null,
    shaderPath: 'sacred-monk.wgsl',
    vertexEntry: 'vs',
    fragmentEntry: 'main',
    performanceMode: 'quality',
    getMaxDevicePixelRatio: () => 2,
    getUniformSnapshot: () => ({
      breathPhase: 0, intensity: 1, chakraPhase: 0, theme: 0, mandalaStyle: 0,
      phaseProgress: 0, strengthLevel: 1, mouse: { x: -2, y: -2 }, mouseStrength: 0,
      chakraFocus: -1, geometryDensity: 1, interference: 0.5, figurePose: 0, qualityPreset: 1,
    }),
    getTimeScale: () => 1,
    governor: {
      setBase: vi.fn(), setPaused: vi.fn(),
      noteFrame: vi.fn(() => ({ resolutionScale: 1 as const, qualityPreset: 1 as const, overlayEnabled: true, p75FrameMs: null, stepDownCount: 0, paused: false, changed: false })),
      getSnapshot: vi.fn(() => ({ resolutionScale: 1 as const, qualityPreset: 1 as const, overlayEnabled: true, p75FrameMs: null, stepDownCount: 0, paused: false })),
    },
    shouldRender: () => true,
    onFatalError: vi.fn(),
    onBackendDiagnostics: vi.fn(),
  };
}

describe('WebGPUBackend', () => {
  let resizeCallback: (() => void) | undefined;
  let rafCallbacks: FrameRequestCallback[];
  let canvasContext: {
    configure: ReturnType<typeof vi.fn>;
    unconfigure: ReturnType<typeof vi.fn>;
    getCurrentTexture: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    rafCallbacks = [];
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('GPUBufferUsage', { UNIFORM: 1, COPY_DST: 2 });
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { resizeCallback = callback; }
      observe() {}
      disconnect() {}
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      url: '/sacred-monk.wgsl',
      text: async () => 'shader',
    })));
    canvasContext = {
      configure: vi.fn(),
      unconfigure: vi.fn(),
      getCurrentTexture: vi.fn(() => ({ createView: () => ({}) })),
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const makeCanvas = () => {
    const canvas = document.createElement('canvas');
    Object.defineProperties(canvas, {
      clientWidth: { configurable: true, value: 320 },
      clientHeight: { configurable: true, value: 180 },
    });
    vi.spyOn(canvas, 'getContext').mockImplementation(((kind: string) => kind === 'webgpu' ? canvasContext : null) as typeof canvas.getContext);
    return canvas;
  };

  it('normalizes compiler locations and message text', () => {
    expect(normalizeCompilationMessages({ messages: [{
      type: 'warning', message: 'careful', lineNum: 7, linePos: 3,
      offset: 0, length: 1, utf16Offset: 0, utf16Length: 1,
    }] } as unknown as GPUCompilationInfo)).toEqual([{ type: 'warning', text: 'careful', line: 7, column: 3 }]);
  });

  it('publishes adapter/compiler metadata and uses explicit device options and labels', async () => {
    const first = makeDevice([{
      type: 'warning', message: 'portable warning', lineNum: 4, linePos: 2,
    }]);
    const requestDevice = vi.fn(async () => first.device);
    const requestAdapter = vi.fn(async () => ({
      info: { vendor: 'Example GPU', architecture: 'mock' }, requestDevice,
    }));
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: {
      requestAdapter,
      getPreferredCanvasFormat: () => 'bgra8unorm',
    } });
    const ctx = makeContext(makeCanvas());
    const backend = new WebGPUBackend();

    await backend.start(ctx);

    expect(requestAdapter).toHaveBeenCalledWith({ powerPreference: 'high-performance', forceFallbackAdapter: false });
    expect(requestDevice).toHaveBeenCalledWith({ label: 'Sacred Breath WebGPU Device', requiredFeatures: [], requiredLimits: {} });
    expect(first.device.createShaderModule).toHaveBeenCalledWith(expect.objectContaining({ label: expect.stringContaining('sacred-monk.wgsl') }));
    expect(first.device.createRenderPipeline).toHaveBeenCalledWith(expect.objectContaining({ label: 'Sacred Breath WebGPU Pipeline' }));
    expect(first.device.createBuffer).toHaveBeenCalledWith(expect.objectContaining({ label: 'Sacred Breath Uniform Buffer' }));
    expect(ctx.onBackendDiagnostics).toHaveBeenCalledWith({ adapterInfo: { vendor: 'Example GPU', architecture: 'mock' } });
    expect(ctx.onBackendDiagnostics).toHaveBeenCalledWith({ compilationMessages: [{ type: 'warning', text: 'portable warning', line: 4, column: 2 }] });
    backend.stop();
  });

  it('stops before pipeline creation when compilation reports an error', async () => {
    const first = makeDevice([{ type: 'error', message: 'bad wgsl', lineNum: 9, linePos: 1 }]);
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: {
      requestAdapter: vi.fn(async () => ({ info: {}, requestDevice: vi.fn(async () => first.device) })),
      getPreferredCanvasFormat: () => 'bgra8unorm',
    } });
    const ctx = makeContext(makeCanvas());

    await new WebGPUBackend().start(ctx);

    expect(first.device.createRenderPipeline).not.toHaveBeenCalled();
    expect(ctx.onFatalError).toHaveBeenCalledWith('WebGPU shader compilation failed.', expect.any(Error));
  });

  it('reacquires adapter/device once after loss and preserves the governor object', async () => {
    const first = makeDevice();
    const second = makeDevice();
    const devices = [first.device, second.device];
    const requestAdapter = vi.fn(async () => ({ info: { vendor: 'Mock' }, requestDevice: vi.fn(async () => devices.shift()!) }));
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: { requestAdapter, getPreferredCanvasFormat: () => 'bgra8unorm' } });
    const ctx = makeContext(makeCanvas());
    const governor = ctx.governor;
    const backend = new WebGPUBackend();
    await backend.start(ctx);

    first.lost.resolve({ reason: 'unknown', message: 'reset' } as GPUDeviceLostInfo);
    await flush();
    await flush();

    expect(requestAdapter).toHaveBeenCalledTimes(2);
    expect(ctx.governor).toBe(governor);
    expect(ctx.onBackendDiagnostics).toHaveBeenCalledWith({ recoveryStatus: 'recovering' });
    expect(ctx.onBackendDiagnostics).toHaveBeenCalledWith({ recoveryStatus: 'recovered' });
    expect(canvasContext.configure).toHaveBeenLastCalledWith(expect.objectContaining({ device: second.device }));

    second.lost.resolve({ reason: 'unknown', message: 'again' } as GPUDeviceLostInfo);
    await flush();
    expect(ctx.onFatalError).toHaveBeenCalledWith(expect.stringContaining('lost again'), 'again');
    backend.stop();
  });

  it('falls back when the one recovery adapter request fails', async () => {
    const first = makeDevice();
    const requestAdapter = vi.fn()
      .mockResolvedValueOnce({ info: {}, requestDevice: vi.fn(async () => first.device) })
      .mockRejectedValueOnce(new Error('adapter reset failed'));
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: { requestAdapter, getPreferredCanvasFormat: () => 'bgra8unorm' } });
    const ctx = makeContext(makeCanvas());
    const backend = new WebGPUBackend();
    await backend.start(ctx);

    first.lost.resolve({ reason: 'unknown', message: 'reset' } as GPUDeviceLostInfo);
    await flush();
    await flush();

    expect(ctx.onBackendDiagnostics).toHaveBeenCalledWith({ recoveryStatus: 'failed' });
    expect(ctx.onFatalError).toHaveBeenCalledWith('WebGPU device recovery failed.', expect.any(Error));
    backend.stop();
  });

  it('reconfigures on resize and retries one current-texture acquisition', async () => {
    const first = makeDevice();
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: {
      requestAdapter: vi.fn(async () => ({ info: {}, requestDevice: vi.fn(async () => first.device) })),
      getPreferredCanvasFormat: () => 'bgra8unorm',
    } });
    const ctx = makeContext(makeCanvas());
    const backend = new WebGPUBackend();
    await backend.start(ctx);
    const initialConfigureCount = canvasContext.configure.mock.calls.length;

    Object.defineProperty(ctx.canvas, 'clientWidth', { configurable: true, value: 400 });
    resizeCallback?.();
    expect(canvasContext.unconfigure).toHaveBeenCalled();
    expect(canvasContext.configure.mock.calls.length).toBeGreaterThan(initialConfigureCount);

    canvasContext.getCurrentTexture.mockImplementationOnce(() => { throw new Error('stale texture'); });
    rafCallbacks.shift()?.(0);
    expect(ctx.onFatalError).not.toHaveBeenCalled();
    expect(canvasContext.configure.mock.calls.length).toBeGreaterThan(initialConfigureCount + 1);
    backend.stop();
  });

  it('treats consecutive current-texture acquisition failures as fatal', async () => {
    const first = makeDevice();
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: {
      requestAdapter: vi.fn(async () => ({ info: {}, requestDevice: vi.fn(async () => first.device) })),
      getPreferredCanvasFormat: () => 'bgra8unorm',
    } });
    const ctx = makeContext(makeCanvas());
    const backend = new WebGPUBackend();
    await backend.start(ctx);
    canvasContext.getCurrentTexture.mockImplementation(() => { throw new Error('texture unavailable'); });

    rafCallbacks.shift()?.(0);
    rafCallbacks.shift()?.(16);

    expect(ctx.onFatalError).toHaveBeenCalledWith(
      'WebGPU could not acquire the current canvas texture after reconfiguration.',
      expect.any(Error),
    );
    backend.stop();
  });

  it('suppresses stale async initialization after stop', async () => {
    const pendingAdapter = deferred<GPUAdapter | null>();
    const requestDevice = vi.fn();
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: {
      requestAdapter: vi.fn(() => pendingAdapter.promise),
      getPreferredCanvasFormat: () => 'bgra8unorm',
    } });
    const ctx = makeContext(makeCanvas());
    const backend = new WebGPUBackend();
    const starting = backend.start(ctx);
    backend.stop();
    pendingAdapter.resolve({ info: {}, requestDevice } as unknown as GPUAdapter);
    await starting;
    expect(requestDevice).not.toHaveBeenCalled();
    expect(ctx.onFatalError).not.toHaveBeenCalled();
  });
});
