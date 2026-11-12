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
  breathFieldStatus?: BreathFieldStatus;
  /** Why the field pipelines could not be built (limits, compile error). */
  breathFieldReason?: string;
}

/** Last stable adaptive-quality tier persisted across sessions. */
export interface GovernorPersistedTier {
  resolutionScale: number;
  qualityPreset: 0 | 1;
  overlayEnabled: boolean;
  particleLevel?: 0 | 1 | 2 | 3;
  bloomLevels?: number;
  hdrEnabled?: boolean;
}

/**
 * WebGPU breath field: `particles` adds the GPU particle sim on the swap
 * chain; `hdr` also renders into an rgba16float target with bloom and a
 * tone-map pass. `off` is the classic scene + overlay, pixel for pixel.
 */
export type BreathFieldMode = 'off' | 'particles' | 'hdr';
export const BREATH_FIELD_MODES: readonly BreathFieldMode[] = ['off', 'particles', 'hdr'];

/** Field pipeline status as last reported by the WebGPU backend. */
export type BreathFieldStatus = 'off' | 'building' | 'on' | 'unavailable';

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
  /** Most recent per-pass GPU time by pass label; null without `timestamp-query`. */
  gpuPassBreakdown: Readonly<Record<string, number>> | null;
  /** Active breath-field tier (WebGPU only). */
  breathField: { status: BreathFieldStatus; particleLevel: number; bloomLevels: number; hdrEnabled: boolean; reason?: string };
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
  /** WebGPU breath field (particles / HDR bloom). Opt-in while it is new. */
  breathField: BreathFieldMode;
}

export const DEFAULT_RENDERER_SETTINGS: RendererSettings = {
  performanceMode: 'auto',
  reducedMotion: false,
  showDiagnostics: false,
  gpuComputeEnabled: true,
  breathField: 'off',
};

export const RENDERER_STORAGE_KEY = 'sacred-breath-renderer';
