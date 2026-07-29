import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RendererBackendContext } from '../types';
import { WebGL2Backend } from '../webgl2Backend';

function makeGl() {
  return {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4,
    COLOR_BUFFER_BIT: 5, TRIANGLES: 6,
    createShader: vi.fn(() => ({})), shaderSource: vi.fn(), compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true), getShaderInfoLog: vi.fn(), deleteShader: vi.fn(),
    createProgram: vi.fn(() => ({})), attachShader: vi.fn(), linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true), getProgramInfoLog: vi.fn(), deleteProgram: vi.fn(),
    createVertexArray: vi.fn(() => ({})), deleteVertexArray: vi.fn(),
    getUniformLocation: vi.fn(() => ({})), viewport: vi.fn(), useProgram: vi.fn(), bindVertexArray: vi.fn(),
    uniform1f: vi.fn(), uniform2f: vi.fn(), clearColor: vi.fn(), clear: vi.fn(), drawArrays: vi.fn(),
  } as unknown as WebGL2RenderingContext;
}

function makeContext(canvas: HTMLCanvasElement): RendererBackendContext {
  return {
    canvas, container: document.createElement('div'), overlay: null,
    shaderPath: 'sacred-monk.wgsl', vertexEntry: 'vs', fragmentEntry: 'main', performanceMode: 'auto',
    getMaxDevicePixelRatio: () => 1,
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
    vi.spyOn(canvas, 'getContext').mockImplementation(((kind: string) => kind === 'webgl2' ? gl : null) as typeof canvas.getContext);
    const ctx = makeContext(canvas);
    const backend = new WebGL2Backend();
    backend.start(ctx);
    return { canvas, gl, ctx, backend };
  };

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
});
