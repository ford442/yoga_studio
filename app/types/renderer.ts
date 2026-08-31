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

export type GpuFailureStage = 'module' | 'pipeline' | 'device';

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
  error?: string;
  timestamp: number;
}

export interface RendererBackendDiagnostics {
  adapterInfo?: RendererAdapterInfo;
  compilationMessages?: RendererCompilationMessage[];
  recoveryStatus?: RendererRecoveryStatus;
  gpuFailureStage?: GpuFailureStage;
  gpuFailureReason?: string;
  webgpuProbe?: WebGpuProbeResult;
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
  /** Rolling p75 frame time in ms; null until enough samples. */
  frameTimeP75Ms: number | null;
  /** How many times the governor has stepped down this session. */
  governorStepDowns: number;
  /** True when the render loop is skipping GPU work. */
  governorPaused: boolean;
  adapterInfo?: RendererAdapterInfo;
  compilationMessages: RendererCompilationMessage[];
  recoveryStatus: RendererRecoveryStatus;
  gpuFailureStage?: GpuFailureStage;
  gpuFailureReason?: string;
  webgpuProbe?: WebGpuProbeResult;
}

export interface RendererSettings {
  performanceMode: PerformanceMode;
  reducedMotion: boolean;
  showDiagnostics: boolean;
  /** Last stable governor tier — next session starts here instead of rediscovering. */
  governorTier?: GovernorPersistedTier;
}

export const DEFAULT_RENDERER_SETTINGS: RendererSettings = {
  performanceMode: 'auto',
  reducedMotion: false,
  showDiagnostics: false,
};

export const RENDERER_STORAGE_KEY = 'sacred-breath-renderer';
