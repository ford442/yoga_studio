import type { UniformValues } from '../lib/shaderContract';
import type { RendererMode } from '../types/renderer';
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
  /** Called on every resize/frame to read the current DPR cap. */
  getMaxDevicePixelRatio: () => number;
  /** Pulls the latest animated prop values without re-triggering React effects. */
  getUniformSnapshot: () => AnimatedUniformValues;
  getTimeScale: () => number;
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
