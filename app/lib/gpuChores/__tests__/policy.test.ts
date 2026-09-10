import { describe, expect, it } from 'vitest';
import { GPU_BREAK_EVEN_PIXELS, cpuBackendFor, selectChoresBackend } from '../policy';
import type { ChorePolicyInput } from '../policy';

const base: ChorePolicyInput = {
  job: 'luma_histogram_bt709',
  pixels: GPU_BREAK_EVEN_PIXELS,
  hasDevice: true,
  gpuComputeDisabled: false,
  hasCanvas2d: true,
};

describe('cpuBackendFor', () => {
  it('sends downsample to Canvas2D when it exists', () => {
    expect(cpuBackendFor('downsample_2d', true)).toBe('canvas');
    expect(cpuBackendFor('downsample_2d', false)).toBe('js');
  });

  it('keeps histogram and LUT on the scalar tier', () => {
    expect(cpuBackendFor('luma_histogram_bt709', true)).toBe('js');
    expect(cpuBackendFor('lut_u8_map', true)).toBe('js');
  });
});

describe('selectChoresBackend', () => {
  it('adopts the renderer device for large images', () => {
    expect(selectChoresBackend(base)).toEqual({
      backend: 'webgpu',
      reason: 'adopted renderer GPUDevice',
    });
  });

  it('honours the kill switch before anything else', () => {
    const decision = selectChoresBackend({ ...base, gpuComputeDisabled: true });

    expect(decision.backend).toBe('js');
    expect(decision.reason).toMatch(/kill switch/);
  });

  it('never assumes a device the renderer has not lent', () => {
    const decision = selectChoresBackend({ ...base, hasDevice: false });

    expect(decision.backend).toBe('js');
    expect(decision.reason).toBe('no renderer GPUDevice on loan');
  });

  it('keeps small poster images on the CPU tier', () => {
    const decision = selectChoresBackend({ ...base, job: 'downsample_2d', pixels: 64 * 64 });

    expect(decision.backend).toBe('canvas');
    expect(decision.reason).toBe('below GPU break-even (4096 px)');
  });
});
