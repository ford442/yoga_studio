import type { PerformanceMode } from '../types/renderer';

/** Keep adapter selection explicit and predictable across browser implementations. */
export function getWebGPUAdapterOptions(mode: PerformanceMode): GPURequestAdapterOptions {
  return {
    powerPreference: mode === 'performance' ? 'low-power' : 'high-performance',
    forceFallbackAdapter: false,
  };
}
