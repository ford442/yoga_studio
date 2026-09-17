import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RendererBackendContext } from '../types';
import { READBACK_INTERVAL_FRAMES } from '../gpuTimestamps';
import { normalizeCompilationMessages, WebGPUBackend } from '../webgpuBackend';

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};

const flush = async () => {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve();
  }
};

function makeDevice(
  messages: Array<Partial<GPUCompilationMessage>> = [],
  scopeErrors: { module?: GPUError; pipeline?: GPUError } = {},
  features: string[] = [],
) {
  const lost = deferred<GPUDeviceLostInfo>();
  const shaderModule = {
    getCompilationInfo: vi.fn(async () => ({ messages })),
  };
  let scopeCount = 0;
  const device = {
    lost: lost.promise,
    features: new Set<string>(features),
    destroy: vi.fn(),
    pushErrorScope: vi.fn(() => { scopeCount += 1; }),
    popErrorScope: vi.fn(async () => {
      if (scopeCount === 1) return scopeErrors.module ?? null;
      return scopeErrors.pipeline ?? null;
    }),
    createShaderModule: vi.fn(() => shaderModule),
    createRenderPipeline: vi.fn(() => ({ getBindGroupLayout: vi.fn(() => ({})) })),
    createRenderPipelineAsync: vi.fn(async () => ({ getBindGroupLayout: vi.fn(() => ({})) })),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    createBuffer: vi.fn(() => ({})),
    createBindGroup: vi.fn(() => ({})),
    createCommandEncoder: vi.fn(),
    queue: { writeBuffer: vi.fn(), submit: vi.fn() },
  };
  return { device: device as unknown as GPUDevice, lost, shaderModule };
}

/** `makeDevice` plus a working `timestamp-query` path (query set + mappable staging buffer). */
function makeTimestampDevice() {
  const made = makeDevice([], {}, ['timestamp-query']);
  const device = made.device as unknown as {
    createQuerySet: unknown;
    createBuffer: ReturnType<typeof vi.fn>;
    createCommandEncoder: ReturnType<typeof vi.fn>;
  };
  const querySet = { destroy: vi.fn() };
  const samples = new ArrayBuffer(32);
  new BigUint64Array(samples)[0] = 2_000_000n;
  new BigUint64Array(samples)[1] = 11_000_000n;
  const staging = {
    mapAsync: vi.fn(async () => undefined),
    getMappedRange: vi.fn(() => samples),
    unmap: vi.fn(),
    destroy: vi.fn(),
  };
  device.createQuerySet = vi.fn(() => querySet);
  let bufferCount = 0;
  device.createBuffer = vi.fn(() => {
    bufferCount += 1;
    // 1: timestamp resolve, 2: MAP_READ staging, 3: the uniform buffer.
    return bufferCount === 2 ? staging : { destroy: vi.fn() };
  });
  const pass = { setPipeline: vi.fn(), setBindGroup: vi.fn(), draw: vi.fn(), end: vi.fn() };
  const encoder = {
    beginRenderPass: vi.fn((_descriptor: GPURenderPassDescriptor) => pass),
    resolveQuerySet: vi.fn(),
    copyBufferToBuffer: vi.fn(),
    finish: vi.fn(() => ({})),
  };
  device.createCommandEncoder = vi.fn(() => encoder);
  return { ...made, querySet, staging, encoder, pass };
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
      setBase: vi.fn(), setPaused: vi.fn(), noteGpuPass: vi.fn(), noteChore: vi.fn(),
      noteFrame: vi.fn(() => ({ resolutionScale: 1 as const, qualityPreset: 1 as const, overlayEnabled: true, p75FrameMs: null, p75GpuMs: null, lastChoreMs: null, bound: null, choresPaused: false, instructorVideoEnabled: true, stepDownCount: 0, paused: false, changed: false })),
      getSnapshot: vi.fn(() => ({ resolutionScale: 1 as const, qualityPreset: 1 as const, overlayEnabled: true, p75FrameMs: null, p75GpuMs: null, lastChoreMs: null, bound: null, choresPaused: false, instructorVideoEnabled: true, stepDownCount: 0, paused: false })),
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
    vi.stubGlobal('GPUBufferUsage', { UNIFORM: 1, COPY_DST: 2, QUERY_RESOLVE: 4, COPY_SRC: 8, MAP_READ: 16 });
    vi.stubGlobal('GPUMapMode', { READ: 1 });
    vi.stubGlobal('GPUTextureUsage', { RENDER_ATTACHMENT: 0x10 });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
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
    }], {}, ['timestamp-query']);
    const requestDevice = vi.fn(async () => first.device);
    const requestAdapter = vi.fn(async () => ({
      info: { vendor: 'Example GPU', architecture: 'mock' },
      features: new Set(['timestamp-query']),
      limits: { maxBufferSize: 268435456 },
      requestDevice,
    }));
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: {
      requestAdapter,
      getPreferredCanvasFormat: () => 'bgra8unorm',
    } });
    const ctx = makeContext(makeCanvas());
    const backend = new WebGPUBackend();

    await backend.start(ctx);

    expect(requestAdapter).toHaveBeenCalledWith({ powerPreference: 'high-performance', forceFallbackAdapter: false });
    expect(requestDevice).toHaveBeenCalledWith({
      label: 'Sacred Breath WebGPU Device',
      requiredFeatures: ['timestamp-query'],
      requiredLimits: { maxBufferSize: 268435456 },
    });
    expect(first.device.createShaderModule).toHaveBeenCalledWith(expect.objectContaining({ label: expect.stringContaining('sacred-monk.wgsl') }));
    expect(first.device.createRenderPipelineAsync).toHaveBeenCalledWith(expect.objectContaining({ label: 'Sacred Breath WebGPU Pipeline' }));
    expect(first.device.createBuffer).toHaveBeenCalledWith(expect.objectContaining({ label: 'Sacred Breath Uniform Buffer' }));
    expect(ctx.onBackendDiagnostics).toHaveBeenCalledWith({ adapterInfo: { vendor: 'Example GPU', architecture: 'mock' } });
    // The mock device has the feature but no `createQuerySet`, so the timer
    // declines to build and the governor keeps CPU timing.
    expect(ctx.onBackendDiagnostics).toHaveBeenCalledWith({
      enabledFeatures: ['timestamp-query'],
      gpuTimestamps: 'off',
    });
    expect(ctx.onBackendDiagnostics).toHaveBeenCalledWith({
      canvasConfig: { format: 'bgra8unorm', alphaMode: 'premultiplied', colorSpace: 'srgb', usage: 0x10 },
    });
    expect(ctx.onBackendDiagnostics).toHaveBeenCalledWith({ compilationMessages: [{ type: 'warning', text: 'portable warning', line: 4, column: 2 }] });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('GPUCompilationInfo warning 4:2 portable warning'));
    expect(first.device.pushErrorScope).toHaveBeenCalledWith('validation');
    expect(first.device.popErrorScope).toHaveBeenCalled();
    const compilationOrder = first.shaderModule.getCompilationInfo.mock.invocationCallOrder[0];
    const firstPopOrder = (first.device.popErrorScope as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    expect(compilationOrder).toBeLessThan(firstPopOrder);
    expect(ctx.onBackendDiagnostics).toHaveBeenCalledWith(expect.objectContaining({
      webgpuProbe: expect.objectContaining({
        ok: true,
        stage: 'ok',
        enabledFeatures: ['timestamp-query'],
        canvasConfig: { format: 'bgra8unorm', alphaMode: 'premultiplied', colorSpace: 'srgb', usage: 0x10 },
      }),
    }));
    backend.stop();
  });

  it('composes a modular shader entry before creating the shader module', async () => {
    const first = makeDevice();
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: {
      requestAdapter: vi.fn(async () => ({ info: {}, features: new Set(), limits: {}, requestDevice: vi.fn(async () => first.device) })),
      getPreferredCanvasFormat: () => 'bgra8unorm',
    } });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === './sacred-ultra.wgsl') {
        return {
          ok: true,
          status: 200,
          url: 'https://example.test/app/sacred-ultra.wgsl',
          text: async () => '// @include "./sacred-ultra/core.wgsl"\n// @include "./sacred-ultra/main.wgsl"\n',
        };
      }
      const source = path.endsWith('/core.wgsl') ? 'const PI: f32 = 3.14;\n' : '@fragment fn main() {}\n';
      return { ok: true, status: 200, url: path, text: async () => source };
    }));
    const ctx = makeContext(makeCanvas());
    ctx.shaderPath = 'sacred-ultra.wgsl';
    const backend = new WebGPUBackend();

    await backend.start(ctx);

    expect(first.device.createShaderModule).toHaveBeenCalledWith(expect.objectContaining({
      code: 'const PI: f32 = 3.14;\n@fragment fn main() {}\n',
    }));
    expect(fetch).toHaveBeenCalledTimes(3);
    backend.stop();
  });

  it('stops before pipeline creation when compilation reports an error', async () => {
    const first = makeDevice([{ type: 'error', message: 'bad wgsl', lineNum: 9, linePos: 1 }]);
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: {
      requestAdapter: vi.fn(async () => ({ info: {}, features: new Set(), limits: {}, requestDevice: vi.fn(async () => first.device) })),
      getPreferredCanvasFormat: () => 'bgra8unorm',
    } });
    const ctx = makeContext(makeCanvas());

    await new WebGPUBackend().start(ctx);

    expect(first.device.createRenderPipelineAsync).not.toHaveBeenCalled();
    expect(ctx.onFatalError).toHaveBeenCalledWith('WebGPU shader module failed.', expect.any(Error));
    expect(ctx.onBackendDiagnostics).toHaveBeenCalledWith(expect.objectContaining({ gpuFailureStage: 'module' }));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('GPUCompilationInfo error 9:1 bad wgsl'));
  });

  it('fatal-fails on module validation scope errors before pipeline creation', async () => {
    const first = makeDevice([], { module: { message: 'invalid wgsl' } as GPUError });
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: {
      requestAdapter: vi.fn(async () => ({ info: {}, features: new Set(), limits: {}, requestDevice: vi.fn(async () => first.device) })),
      getPreferredCanvasFormat: () => 'bgra8unorm',
    } });
    const ctx = makeContext(makeCanvas());

    await new WebGPUBackend().start(ctx);

    expect(first.device.createRenderPipelineAsync).not.toHaveBeenCalled();
    expect(ctx.onFatalError).toHaveBeenCalledWith('WebGPU shader module failed.', expect.any(Error));
    expect(ctx.onBackendDiagnostics).toHaveBeenCalledWith(expect.objectContaining({
      gpuFailureStage: 'module',
      gpuFailureReason: 'WebGPU shader module failed.',
    }));
    expect(console.error).toHaveBeenCalledWith('[WebGPU] module validation:', 'invalid wgsl');
  });

  it('fatal-fails on pipeline validation scope errors when compilation info is empty', async () => {
    const first = makeDevice([], { pipeline: { message: 'bad pipeline' } as GPUError });
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: {
      requestAdapter: vi.fn(async () => ({ info: {}, features: new Set(), limits: {}, requestDevice: vi.fn(async () => first.device) })),
      getPreferredCanvasFormat: () => 'bgra8unorm',
    } });
    const ctx = makeContext(makeCanvas());

    await new WebGPUBackend().start(ctx);

    expect(first.device.createRenderPipelineAsync).toHaveBeenCalled();
    expect(ctx.onFatalError).toHaveBeenCalledWith('WebGPU render pipeline failed.', expect.any(Error));
    expect(ctx.onBackendDiagnostics).toHaveBeenCalledWith(expect.objectContaining({
      gpuFailureStage: 'pipeline',
      gpuFailureReason: 'WebGPU render pipeline failed.',
    }));
    expect(console.error).toHaveBeenCalledWith('[WebGPU] pipeline validation:', 'bad pipeline');
    expect(ctx.onBackendDiagnostics).toHaveBeenCalledWith(expect.objectContaining({
      webgpuProbe: expect.objectContaining({ ok: false, stage: 'pipeline' }),
    }));
  });

  it('reacquires adapter/device once after loss and preserves the governor object', async () => {
    const first = makeDevice();
    const second = makeDevice();
    const devices = [first.device, second.device];
    const requestAdapter = vi.fn(async () => ({
      info: { vendor: 'Mock' }, features: new Set(), limits: {}, requestDevice: vi.fn(async () => devices.shift()!),
    }));
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
    expect(ctx.onBackendDiagnostics).toHaveBeenCalledWith(expect.objectContaining({ recoveryStatus: 'recovering' }));
    expect(ctx.onBackendDiagnostics).toHaveBeenCalledWith(expect.objectContaining({ recoveryStatus: 'recovered' }));
    expect(canvasContext.configure).toHaveBeenLastCalledWith(expect.objectContaining({ device: second.device }));

    second.lost.resolve({ reason: 'unknown', message: 'again' } as GPUDeviceLostInfo);
    await flush();
    expect(ctx.onFatalError).toHaveBeenCalledWith(expect.stringContaining('lost again'), 'again');
    backend.stop();
  });

  it('falls back when the one recovery adapter request fails', async () => {
    const first = makeDevice();
    const requestAdapter = vi.fn()
      .mockResolvedValueOnce({ info: {}, features: new Set(), limits: {}, requestDevice: vi.fn(async () => first.device) })
      .mockRejectedValueOnce(new Error('adapter reset failed'));
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: { requestAdapter, getPreferredCanvasFormat: () => 'bgra8unorm' } });
    const ctx = makeContext(makeCanvas());
    const backend = new WebGPUBackend();
    await backend.start(ctx);

    first.lost.resolve({ reason: 'unknown', message: 'reset' } as GPUDeviceLostInfo);
    await flush();
    await flush();

    expect(ctx.onBackendDiagnostics).toHaveBeenCalledWith(expect.objectContaining({ recoveryStatus: 'failed' }));
    expect(ctx.onFatalError).toHaveBeenCalledWith('WebGPU device recovery failed.', expect.any(Error));
    backend.stop();
  });

  it('treats uncaptured GPU errors as a staged fatal failure', async () => {
    const first = makeDevice();
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: {
      requestAdapter: vi.fn(async () => ({ info: {}, features: new Set(), limits: {}, requestDevice: vi.fn(async () => first.device) })),
      getPreferredCanvasFormat: () => 'bgra8unorm',
    } });
    const ctx = makeContext(makeCanvas());
    const backend = new WebGPUBackend();
    await backend.start(ctx);

    const listener = (first.device.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === 'uncapturederror',
    )?.[1] as ((event: { preventDefault: () => void; error: { message: string } }) => void) | undefined;
    expect(listener).toBeTypeOf('function');
    listener?.({ preventDefault: vi.fn(), error: { message: 'WGSL parse failed at line 2' } });

    expect(ctx.onFatalError).toHaveBeenCalledWith('WebGPU shader module failed.', expect.objectContaining({
      message: 'WGSL parse failed at line 2',
    }));
    backend.stop();
  });

  it('reconfigures on resize and retries one current-texture acquisition', async () => {
    const first = makeDevice();
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: {
      requestAdapter: vi.fn(async () => ({ info: {}, features: new Set(), limits: {}, requestDevice: vi.fn(async () => first.device) })),
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
      requestAdapter: vi.fn(async () => ({ info: {}, features: new Set(), limits: {}, requestDevice: vi.fn(async () => first.device) })),
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


  it('times the scene pass with a timestamp query set and feeds the governor', async () => {
    const first = makeTimestampDevice();
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: {
      requestAdapter: vi.fn(async () => ({
        info: {},
        features: new Set(['timestamp-query']),
        limits: {},
        requestDevice: vi.fn(async () => first.device),
      })),
      getPreferredCanvasFormat: () => 'bgra8unorm',
    } });
    const ctx = makeContext(makeCanvas());
    const backend = new WebGPUBackend();
    await backend.start(ctx);

    expect(ctx.onBackendDiagnostics).toHaveBeenCalledWith(
      expect.objectContaining({ gpuTimestamps: 'on' }),
    );
    expect((first.device as unknown as { createQuerySet: ReturnType<typeof vi.fn> }).createQuerySet)
      .toHaveBeenCalledWith(expect.objectContaining({ type: 'timestamp', count: 4 }));

    // Drive frames until the sampled one lands; unsampled frames stay plain.
    for (let i = 0; i < READBACK_INTERVAL_FRAMES; i += 1) rafCallbacks.shift()?.(i * 16);
    const sampledPasses = first.encoder.beginRenderPass.mock.calls
      .map(([descriptor]) => descriptor.timestampWrites)
      .filter(Boolean);
    // Exactly one frame in the interval carries timestampWrites.
    expect(sampledPasses).toHaveLength(1);
    expect(sampledPasses[0]).toEqual(
      expect.objectContaining({ beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 }),
    );
    expect(first.encoder.resolveQuerySet).toHaveBeenCalledTimes(1);

    // mapAsync resolves off the rAF path; the next frame reports the measurement.
    await flush();
    rafCallbacks.shift()?.(1000);
    expect(ctx.governor.noteGpuPass).toHaveBeenCalledWith(expect.any(Number), 9);
    backend.stop();
    expect(first.querySet.destroy).toHaveBeenCalled();
  });

  it('boots and keeps CPU timing on adapters without timestamp-query', async () => {
    const first = makeDevice();
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: {
      requestAdapter: vi.fn(async () => ({ info: {}, features: new Set(), limits: {}, requestDevice: vi.fn(async () => first.device) })),
      getPreferredCanvasFormat: () => 'bgra8unorm',
    } });
    const ctx = makeContext(makeCanvas());
    const backend = new WebGPUBackend();
    await backend.start(ctx);

    expect(ctx.onFatalError).not.toHaveBeenCalled();
    expect(ctx.onBackendDiagnostics).toHaveBeenCalledWith(
      expect.objectContaining({ gpuTimestamps: 'unsupported' }),
    );
    expect(ctx.governor.noteGpuPass).not.toHaveBeenCalled();
    backend.stop();
  });

  it('destroys the query set when the device is lost so recovery starts clean', async () => {
    const first = makeTimestampDevice();
    const second = makeTimestampDevice();
    const requestDevice = vi.fn()
      .mockResolvedValueOnce(first.device)
      .mockResolvedValueOnce(second.device);
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: {
      requestAdapter: vi.fn(async () => ({
        info: {}, features: new Set(['timestamp-query']), limits: {}, requestDevice,
      })),
      getPreferredCanvasFormat: () => 'bgra8unorm',
    } });
    const ctx = makeContext(makeCanvas());
    const backend = new WebGPUBackend();
    await backend.start(ctx);

    first.lost.resolve({ reason: 'destroyed', message: 'gpu reset' } as GPUDeviceLostInfo);
    await flush();
    await flush();

    expect(first.querySet.destroy).toHaveBeenCalled();
    expect((second.device as unknown as { createQuerySet: ReturnType<typeof vi.fn> }).createQuerySet)
      .toHaveBeenCalled();
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
