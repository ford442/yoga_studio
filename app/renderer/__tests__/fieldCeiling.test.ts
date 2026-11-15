import { describe, expect, it } from 'vitest';
import { FIELD_OFF } from '../frameGovernor';
import { resolveFieldCeiling } from '../quality';

const base = {
  mode: 'hdr' as const,
  rendererMode: 'webgpu' as const,
  qualityPreset: 1,
  reducedMotion: false,
  performanceMode: 'quality' as const,
  unavailable: false,
};

describe('resolveFieldCeiling', () => {
  it('opens the full HDR field on a high-quality WebGPU session', () => {
    expect(resolveFieldCeiling(base)).toEqual({ particleLevel: 3, bloomLevels: 5, hdrEnabled: true });
  });

  it('keeps particles but no HDR in particles mode', () => {
    expect(resolveFieldCeiling({ ...base, mode: 'particles' })).toEqual({ particleLevel: 3, bloomLevels: 0, hdrEnabled: false });
  });

  it('caps the mobile preset lower', () => {
    expect(resolveFieldCeiling({ ...base, qualityPreset: 0 })).toEqual({ particleLevel: 2, bloomLevels: 3, hdrEnabled: true });
  });

  it('is off for WebGL2/static, reduced motion, an unavailable field, or the setting off', () => {
    expect(resolveFieldCeiling({ ...base, rendererMode: 'webgl2' })).toEqual(FIELD_OFF);
    expect(resolveFieldCeiling({ ...base, rendererMode: 'static' })).toEqual(FIELD_OFF);
    expect(resolveFieldCeiling({ ...base, reducedMotion: true })).toEqual(FIELD_OFF);
    expect(resolveFieldCeiling({ ...base, unavailable: true })).toEqual(FIELD_OFF);
    expect(resolveFieldCeiling({ ...base, mode: 'off' })).toEqual(FIELD_OFF);
  });

  it('keeps performance mode to the smallest field without HDR', () => {
    expect(resolveFieldCeiling({ ...base, performanceMode: 'performance' })).toEqual({ particleLevel: 1, bloomLevels: 0, hdrEnabled: false });
  });
});
