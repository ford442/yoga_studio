import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fallbackOrder,
  pickInitialMode,
  getNextMode,
  createBackend,
  mountRenderer,
} from '../selectBackend';
import { WebGPUBackend } from '../webgpuBackend';
import { WebGL2Backend } from '../webgl2Backend';
import { StaticBackend } from '../staticBackend';
import type { RendererBackendContext } from '../types';

const fullCaps = { webgpu: true, webgl2: true };
const noWebgpuCaps = { webgpu: false, webgl2: true };
const noneCaps = { webgpu: false, webgl2: false };

describe('fallbackOrder', () => {
  it('orders webgpu -> webgl2 -> static when everything is supported', () => {
    expect(fallbackOrder(fullCaps)).toEqual(['webgpu', 'webgl2', 'static']);
  });

  it('skips webgpu when unsupported', () => {
    expect(fallbackOrder(noWebgpuCaps)).toEqual(['webgl2', 'static']);
  });

  it('always terminates at static, even with nothing else supported', () => {
    expect(fallbackOrder(noneCaps)).toEqual(['static']);
  });
});

describe('pickInitialMode', () => {
  it('picks webgpu when available', () => {
    expect(pickInitialMode(fullCaps)).toBe('webgpu');
  });

  it('picks webgl2 when webgpu is unavailable', () => {
    expect(pickInitialMode(noWebgpuCaps)).toBe('webgl2');
  });

  it('picks static as a last resort', () => {
    expect(pickInitialMode(noneCaps)).toBe('static');
  });
});

describe('getNextMode', () => {
  it('advances webgpu -> webgl2 -> static', () => {
    expect(getNextMode('webgpu', fullCaps)).toBe('webgl2');
    expect(getNextMode('webgl2', fullCaps)).toBe('static');
  });

  it('is terminal at static', () => {
    expect(getNextMode('static', fullCaps)).toBe('static');
  });

  it('skips straight to static when webgl2 is also unsupported', () => {
    expect(getNextMode('webgpu', noneCaps)).toBe('static');
  });

  it('falls back to static for an unrecognized mode', () => {
    expect(getNextMode('bogus' as never, fullCaps)).toBe('static');
  });
});

describe('createBackend', () => {
  it('instantiates the matching backend class for each mode', () => {
    expect(createBackend('webgpu')).toBeInstanceOf(WebGPUBackend);
    expect(createBackend('webgl2')).toBeInstanceOf(WebGL2Backend);
    expect(createBackend('static')).toBeInstanceOf(StaticBackend);
  });
});

describe('mountRenderer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const baseCtx = (): Omit<RendererBackendContext, 'onFatalError'> => ({
    canvas: {} as HTMLCanvasElement,
    container: {} as HTMLElement,
    overlay: null,
    shaderPath: 'sacred-lotus-final.wgsl',
    vertexEntry: 'vs',
    fragmentEntry: 'main',
    getMaxDevicePixelRatio: () => 2,
    getUniformSnapshot: () => ({
      breathPhase: 0,
      intensity: 1,
      chakraPhase: 0,
      theme: 0,
      mandalaStyle: 0,
      phaseProgress: 0,
      strengthLevel: 1,
      mouse: { x: -2, y: -2 },
      mouseStrength: 0,
      chakraFocus: -1,
      geometryDensity: 1,
      interference: 0.5,
      figurePose: 0,
      qualityPreset: 1,
    }),
    getTimeScale: () => 1,
  });

  it('starts the backend for the requested mode', () => {
    const startSpy = vi.spyOn(WebGL2Backend.prototype, 'start').mockImplementation(() => {});
    vi.spyOn(WebGL2Backend.prototype, 'stop').mockImplementation(() => {});

    const onFallback = vi.fn();
    const unmount = mountRenderer({ mode: 'webgl2', caps: fullCaps, onFallback, ...baseCtx() });

    expect(startSpy).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('advances to the next mode in the chain when the backend reports a fatal error', () => {
    vi.spyOn(WebGPUBackend.prototype, 'start').mockImplementation(async (ctx) => {
      ctx.onFatalError('WebGPU device was lost.');
    });
    vi.spyOn(WebGPUBackend.prototype, 'stop').mockImplementation(() => {});

    const onFallback = vi.fn();
    const unmount = mountRenderer({ mode: 'webgpu', caps: fullCaps, onFallback, ...baseCtx() });

    expect(onFallback).toHaveBeenCalledWith('webgl2', 'WebGPU device was lost.');
    unmount();
  });

  it('does not report a fallback after the backend has been unmounted', () => {
    let capturedOnFatalError: ((reason: string) => void) | undefined;
    vi.spyOn(WebGPUBackend.prototype, 'start').mockImplementation(async (ctx) => {
      capturedOnFatalError = ctx.onFatalError;
    });
    vi.spyOn(WebGPUBackend.prototype, 'stop').mockImplementation(() => {});

    const onFallback = vi.fn();
    const unmount = mountRenderer({ mode: 'webgpu', caps: fullCaps, onFallback, ...baseCtx() });
    unmount();
    capturedOnFatalError?.('late failure');

    expect(onFallback).not.toHaveBeenCalled();
  });
});
