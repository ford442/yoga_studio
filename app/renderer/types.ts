import type { UniformValues } from '../lib/shaderContract';
import type { PerformanceMode, RendererBackendDiagnostics, RendererMode } from '../types/renderer';
import type { FrameGovernor } from './frameGovernor';
import type { GeometryOverlay } from './overlay';

export type { RendererMode };

/** Animated uniform values a backend reads every frame; `time`/`resolution` are always backend-computed. */
export type AnimatedUniformValues = Omit<UniformValues, 'time' | 'resolution'>;

/** Everything a backend needs to boot and run its render loop. */
export interface RendererBackendContext {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  overlay: GeometryOverlay | null;
  shaderPath: string;
  vertexEntry: string;
  fragmentEntry: string;
  performanceMode: PerformanceMode;
  /** Called on every resize/frame to read the current DPR cap (includes governor scale). */
  getMaxDevicePixelRatio: () => number;
  /** Pulls the latest animated prop values without re-triggering React effects. */
  getUniformSnapshot: () => AnimatedUniformValues;
  getTimeScale: () => number;
  /** Adaptive quality controller shared across backends. */
  governor: FrameGovernor;
  /** When false, skip GPU work (e.g. completion overlay covering the canvas). */
  shouldRender: () => boolean;
  /** Fired when the governor tier changes so React can persist / report diagnostics. */
  onGovernorChange?: () => void;
  /** Publishes backend-specific adapter, compiler, and recovery details. */
  onBackendDiagnostics?: (diagnostics: RendererBackendDiagnostics) => void;
  /**
   * Backend hit an unrecoverable error (device lost, context lost, init
   * failure). The caller decides whether/how to fall back.
   */
  onFatalError: (reason: string, error?: unknown) => void;
}

/** A renderer backend owns one GPU API's pipeline, render loop, and cleanup. */
export interface RendererBackend {
  readonly mode: RendererMode;
  start(ctx: RendererBackendContext): Promise<void> | void;
  stop(): void;
}

export type GLUniforms = Record<string, WebGLUniformLocation | null>;
