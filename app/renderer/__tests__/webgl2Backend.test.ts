import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getWebGL2ContextOptions } from '../gpuDeviceContract';
import type { RendererBackendContext } from '../types';
import { WebGL2Backend } from '../webgl2Backend';

function makeGl() {
  return {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4,
    COLOR_BUFFER_BIT: 5, TRIANGLES: 6, BLEND: 7, FUNC_ADD: 8, ONE_MINUS_DST_COLOR: 9, ONE: 10, ZERO: 11,
    createShader: vi.fn(() => ({})), shaderSource: vi.fn(), compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true), getShaderInfoLog: vi.fn(), deleteShader: vi.fn(),
    createProgram: vi.fn(() => ({})), attachShader: vi.fn(), linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true), getProgramInfoLog: vi.fn(), deleteProgram: vi.fn(),
    createVertexArray: vi.fn(() => ({})), deleteVertexArray: vi.fn(),
    getUniformLocation: vi.fn(() => ({})), viewport: vi.fn(), useProgram: vi.fn(), bindVertexArray: vi.fn(),
    uniform1f: vi.fn(), uniform2f: vi.fn(), clearColor: vi.fn(), clear: vi.fn(), drawArrays: vi.fn(),
    enable: vi.fn(), disable: vi.fn(), blendEquation: vi.fn(), blendFuncSeparate: vi.fn(),
  } as unknown as WebGL2RenderingContext;
}

function makeContext(canvas: HTMLCanvasElement): RendererBackendContext {
  return {
    canvas, container: document.createElement('div'),
    shaderPath: 'sacred-monk.wgsl', vertexEntry: 'vs', fragmentEntry: 'main', performanceMode: 'auto',
    getMaxDevicePixelRatio: () => 1,
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

describe('WebGL2Backend recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('ResizeObserver', class { observe() {}; disconnect() {} });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const setup = () => {
    const canvas = document.createElement('canvas');
    Object.defineProperties(canvas, {
      clientWidth: { configurable: true, value: 300 },
      clientHeight: { configurable: true, value: 200 },
    });
    const gl = makeGl();
    const getContext = vi.spyOn(canvas, 'getContext').mockImplementation(((kind: string) => kind === 'webgl2' ? gl : null) as typeof canvas.getContext);
    const ctx = makeContext(canvas);
    const backend = new WebGL2Backend();
    backend.start(ctx);
    return { canvas, gl, ctx, backend, getContext };
  };

  it('requests the WebGL2 context using the shared adapter/canvas contract for the performance mode', () => {
    const { getContext, backend } = setup();
    expect(getContext).toHaveBeenCalledWith('webgl2', getWebGL2ContextOptions('auto'));
    backend.stop();
  });

  it('prevents loss and rebuilds resources after one restoration', () => {
    const { canvas, gl, ctx, backend } = setup();
    const loss = new Event('webglcontextlost', { cancelable: true });
    canvas.dispatchEvent(loss);
    expect(loss.defaultPrevented).toBe(true);
    expect(ctx.onBackendDiagnostics).toHaveBeenCalledWith({ recoveryStatus: 'recovering' });

    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(gl.createProgram).toHaveBeenCalledTimes(2);
    expect(gl.createVertexArray).toHaveBeenCalledTimes(2);
    expect(gl.viewport).toHaveBeenCalled();
    expect(ctx.onBackendDiagnostics).toHaveBeenCalledWith({ recoveryStatus: 'recovered' });
    expect(ctx.onFatalError).not.toHaveBeenCalled();

    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    expect(ctx.onFatalError).toHaveBeenCalledWith('WebGL2 context was lost again.');
    backend.stop();
  });

  it('falls through after the two-second restoration timeout', () => {
    const { canvas, ctx, backend } = setup();
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    vi.advanceTimersByTime(1999);
    expect(ctx.onFatalError).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(ctx.onFatalError).toHaveBeenCalledWith('WebGL2 context restoration timed out after 2 seconds.');
    backend.stop();
  });

  it('removes both listeners and clears the pending timer on cleanup', () => {
    const { canvas, ctx, backend } = setup();
    const removeSpy = vi.spyOn(canvas, 'removeEventListener');
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    backend.stop();
    vi.advanceTimersByTime(2000);
    expect(ctx.onFatalError).not.toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalledWith('webglcontextlost', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('webglcontextrestored', expect.any(Function));
  });

  it('draws the overlay into its own context with a screen blend instead of opening a second one', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => frames.push(callback)));
    const { gl, ctx, backend, getContext } = setup();

    frames.shift()?.(0);
    frames.shift()?.(16);

    expect(getContext).toHaveBeenCalledTimes(1);
    // Scene + overlay per frame, both 3-vertex fullscreen triangles.
    expect(gl.drawArrays).toHaveBeenCalledTimes(4);
    expect(gl.drawArrays).toHaveBeenCalledWith(gl.TRIANGLES, 0, 3);
    expect(gl.blendFuncSeparate).toHaveBeenCalledWith(gl.ONE_MINUS_DST_COLOR, gl.ONE, gl.ZERO, gl.ONE);
    expect(gl.disable).toHaveBeenCalledWith(gl.BLEND);
    // Overlay program is compiled once, on first use, not per frame.
    expect(gl.createProgram).toHaveBeenCalledTimes(2);
    expect(ctx.onFatalError).not.toHaveBeenCalled();
    backend.stop();
  });

  it('skips the overlay draw when the governor turns it off', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => frames.push(callback)));
    const { gl, ctx, backend } = setup();
    const snap = { ...ctx.governor.getSnapshot(), overlayEnabled: false };
    ctx.governor.noteFrame = vi.fn(() => ({ ...snap, changed: false }));

    frames.shift()?.(0);

    expect(gl.drawArrays).toHaveBeenCalledTimes(1);
    expect(gl.createProgram).toHaveBeenCalledTimes(1);
    backend.stop();
  });
});
