export type PerformanceMode = 'auto' | 'performance' | 'quality';
export type RendererMode = 'webgpu' | 'webgl2' | 'static';

export interface RendererDiagnosticsState {
  mode: RendererMode;
  fallbackReason?: string;
  activeShader: string;
  qualityPreset: number;
  maxDevicePixelRatio: number;
  overlayEnabled: boolean;
  reducedMotion: boolean;
  batterySaver: boolean;
}

export interface RendererSettings {
  performanceMode: PerformanceMode;
  reducedMotion: boolean;
  showDiagnostics: boolean;
}

export const DEFAULT_RENDERER_SETTINGS: RendererSettings = {
  performanceMode: 'auto',
  reducedMotion: false,
  showDiagnostics: false,
};

export const RENDERER_STORAGE_KEY = 'sacred-breath-renderer';
