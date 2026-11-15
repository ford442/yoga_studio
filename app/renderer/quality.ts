import type { BreathFieldMode, PerformanceMode, RendererMode } from '../types/renderer';
import { FIELD_OFF, MAX_BLOOM_LEVELS, MAX_PARTICLE_LEVEL, type FieldTier, type ParticleLevel } from './frameGovernor';

/** Heuristically pick a quality preset (0=mobile, 1=high) when the caller hasn't pinned one. */
export const resolveQualityPreset = (explicit?: number): number => {
  if (explicit !== undefined) return explicit >= 0.5 ? 1 : 0;
  if (typeof window === 'undefined') return 1;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const highDpr = window.devicePixelRatio >= 2;
  const narrow = window.innerWidth < 900;
  const lowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4;
  const lowCoreCount = navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 6;
  return highDpr || narrow || lowMemory || lowCoreCount ? 0 : 1;
};

/** Cap the device pixel ratio used for the render target based on quality preset. */
export const resolveMaxDpr = (qualityPreset: number, maxDevicePixelRatio?: number): number => {
  if (maxDevicePixelRatio !== undefined) return Math.max(1, maxDevicePixelRatio);
  return qualityPreset < 0.5 ? 1.5 : 2;
};

/**
 * Breath-field ceiling for the governor. The field is WebGPU-only and opt-in
 * (`breathField` setting); reduced motion turns it off outright because it is
 * pure motion, and performance mode keeps it to the smallest particle count
 * with no HDR/bloom. The governor may shed below this, never above.
 */
export const resolveFieldCeiling = (options: {
  mode: BreathFieldMode;
  rendererMode: RendererMode;
  qualityPreset: number;
  reducedMotion: boolean;
  performanceMode: PerformanceMode;
  /** The backend could not build the field pipelines on this device. */
  unavailable: boolean;
}): FieldTier => {
  const { mode, rendererMode, qualityPreset, reducedMotion, performanceMode, unavailable } = options;
  if (mode === 'off' || rendererMode !== 'webgpu' || reducedMotion || unavailable) return FIELD_OFF;
  if (performanceMode === 'performance') return { particleLevel: 1, bloomLevels: 0, hdrEnabled: false };
  const particleLevel: ParticleLevel = qualityPreset >= 0.5 ? MAX_PARTICLE_LEVEL : 2;
  if (mode === 'particles') return { particleLevel, bloomLevels: 0, hdrEnabled: false };
  return { particleLevel, bloomLevels: qualityPreset >= 0.5 ? MAX_BLOOM_LEVELS : 3, hdrEnabled: true };
};
