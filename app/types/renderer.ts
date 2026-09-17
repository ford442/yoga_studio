import type { ChoresStatus } from '../lib/gpuChores/breadcrumbs';

export type PerformanceMode = 'auto' | 'performance' | 'quality';
export type RendererMode = 'webgpu' | 'webgl2' | 'static';

export interface RendererAdapterInfo {
  vendor?: string;
  architecture?: string;
  device?: string;
  description?: string;
}

export interface RendererCompilationMessage {
  type: 'error' | 'warning' | 'info';
  text: string;
  line: number;
  column: number;
}

export type RendererRecoveryStatus = 'idle' | 'recovering' | 'recovered' | 'failed';

/** Resolved `context.configure()` options, published for diagnostics rather than assumed. */
export interface RendererCanvasConfig {
  format: string;
  alphaMode: string;
  colorSpace: string;
  usage: number;
}

export type GpuFailureStage = 'module' | 'pipeline' | 'device';

/**
 * Whether the renderer is measuring real GPU pass time.
 * `unsupported` = the adapter has no `timestamp-query` (Safari/Firefox today);
 * `off` = the feature exists but the query set failed or was torn down.
 */
export type GpuTimestampStatus = 'on' | 'unsupported' | 'off';

export const GPU_FAILURE_STAGE_LABEL: Record<GpuFailureStage, string> = {
  module: 'shader module',
  pipeline: 'render pipeline',
  device: 'device',
};

/** Result of the one-shot WebGPU boot probe (adapter + device + first pipeline). */
export interface WebGpuProbeResult {
  ok: boolean;
  stage: GpuFailureStage | 'ok';
  userAgent: string;
  adapterInfo?: RendererAdapterInfo;
  compilationMessages: RendererCompilationMessage[];
  enabledFeatures?: string[];
  canvasConfig?: RendererCanvasConfig;
  error?: string;
  timestamp: number;
}

export interface RendererBackendDiagnostics {
  adapterInfo?: RendererAdapterInfo;
  compilationMessages?: RendererCompilationMessage[];
  enabledFeatures?: string[];
  canvasConfig?: RendererCanvasConfig;
  recoveryStatus?: RendererRecoveryStatus;
  gpuFailureStage?: GpuFailureStage;
  gpuFailureReason?: string;
  webgpuProbe?: WebGpuProbeResult;
  gpuTimestamps?: GpuTimestampStatus;
}

/** Last stable adaptive-quality tier persisted across sessions. */
export interface GovernorPersistedTier {
  resolutionScale: number;
  qualityPreset: 0 | 1;
  overlayEnabled: boolean;
}

export interface RendererDiagnosticsState {
  mode: RendererMode;
  fallbackReason?: string;
  activeShader: string;
  qualityPreset: number;
  maxDevicePixelRatio: number;
  overlayEnabled: boolean;
  reducedMotion: boolean;
  batterySaver: boolean;
  /** Internal render-target scale (1 = full DPR cap). */
  resolutionScale: number;
  /** Rolling p75 CPU frame time in ms; null until enough samples. */
  frameTimeP75Ms: number | null;
  /** Rolling p75 GPU pass time in ms; null without `timestamp-query`. */
  gpuPassP75Ms: number | null;
  /** Duration of the most recent gpu-chore in ms. */
  choreLastMs: number | null;
  /** Whether GPU pass timing is actually running. */
  gpuTimestamps: GpuTimestampStatus;
  /** Which signal the governor last acted on. */
  governorBound: 'gpu' | 'cpu' | null;
  /** Governor asked gpu-chores to stand down (CPU-bound relief). */
  choresPaused: boolean;
  /** Governor's verdict on the instructor video layer (consumed by the layer graph). */
  instructorVideoEnabled: boolean;
  /** How many times the governor has stepped down this session. */
  governorStepDowns: number;
  /** True when the render loop is skipping GPU work. */
  governorPaused: boolean;
  adapterInfo?: RendererAdapterInfo;
  compilationMessages: RendererCompilationMessage[];
  enabledFeatures?: string[];
  canvasConfig?: RendererCanvasConfig;
  recoveryStatus: RendererRecoveryStatus;
  gpuFailureStage?: GpuFailureStage;
  gpuFailureReason?: string;
  webgpuProbe?: WebGpuProbeResult;
  /** Backend the shared gpu-chores kit (histogram / thumbs / LUT) last ran on. */
  chores?: ChoresStatus;
}

export interface RendererSettings {
  performanceMode: PerformanceMode;
  reducedMotion: boolean;
  showDiagnostics: boolean;
  /** Settings-equivalent of `?no_gpu_compute`: off pins gpu-chores to Canvas2D / JS. */
  gpuComputeEnabled: boolean;
  /** Last stable governor tier — next session starts here instead of rediscovering. */
  governorTier?: GovernorPersistedTier;
}

export const DEFAULT_RENDERER_SETTINGS: RendererSettings = {
  performanceMode: 'auto',
  reducedMotion: false,
  showDiagnostics: false,
  gpuComputeEnabled: true,
};

export const RENDERER_STORAGE_KEY = 'sacred-breath-renderer';
