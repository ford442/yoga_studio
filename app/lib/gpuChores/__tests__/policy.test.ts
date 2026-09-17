import { describe, expect, it } from 'vitest';
import { GPU_BREAK_EVEN_PIXELS, cpuBackendFor, selectChoresBackend } from '../policy';
import type { ChorePolicyInput } from '../policy';

const base: ChorePolicyInput = {
  job: 'luma_histogram_bt709',
  pixels: GPU_BREAK_EVEN_PIXELS,
  hasDevice: true,
  gpuComputeDisabled: false,
  hasCanvas2d: true,
  hasWasm: false,
};

describe('cpuBackendFor', () => {
  it('sends downsample to Canvas2D when it exists and there is no WASM', () => {
    expect(cpuBackendFor('downsample_2d', true, false)).toBe('canvas');
    expect(cpuBackendFor('downsample_2d', false, false)).toBe('js');
  });

  it('keeps histogram and LUT on the scalar tier without WASM', () => {
    expect(cpuBackendFor('luma_histogram_bt709', true, false)).toBe('js');
    expect(cpuBackendFor('lut_u8_map', true, false)).toBe('js');
  });

  it('prefers WASM over Canvas2D and JS for every job', () => {
    // Including downsample: Canvas2D `drawImage` is the browser's filter, not
    // the area average the kit specifies, so it only matches the goldens
    // approximately where the native kernel is bit-exact.
    expect(cpuBackendFor('downsample_2d', true, true)).toBe('wasm');
    expect(cpuBackendFor('luma_histogram_bt709', true, true)).toBe('wasm');
    expect(cpuBackendFor('lut_u8_map', false, true)).toBe('wasm');
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

  it('lands on WASM, not JS, when the GPU tier is off but the kernels loaded', () => {
    const killed = selectChoresBackend({ ...base, gpuComputeDisabled: true, hasWasm: true });
    expect(killed.backend).toBe('wasm');
    expect(killed.reason).toMatch(/kill switch/);

    const noDevice = selectChoresBackend({ ...base, hasDevice: false, hasWasm: true });
    expect(noDevice.backend).toBe('wasm');

    const small = selectChoresBackend({ ...base, pixels: 64 * 64, hasWasm: true });
    expect(small.backend).toBe('wasm');
    expect(small.reason).toBe('below GPU break-even (4096 px)');
  });

  it('still takes WebGPU over WASM past the break-even', () => {
    expect(selectChoresBackend({ ...base, hasWasm: true }).backend).toBe('webgpu');
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
