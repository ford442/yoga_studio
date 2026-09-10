import { describe, expect, it } from 'vitest';
import { hasNoGpuComputeParam, isGpuComputeDisabled } from '../flags';

describe('hasNoGpuComputeParam', () => {
  it('accepts the bare flag and explicit truthy values', () => {
    expect(hasNoGpuComputeParam('?no_gpu_compute')).toBe(true);
    expect(hasNoGpuComputeParam('no_gpu_compute=1')).toBe(true);
    expect(hasNoGpuComputeParam('?a=b&no_gpu_compute=yes')).toBe(true);
  });

  it('ignores an absent or explicitly disabled flag', () => {
    expect(hasNoGpuComputeParam('')).toBe(false);
    expect(hasNoGpuComputeParam('?other=1')).toBe(false);
    expect(hasNoGpuComputeParam('?no_gpu_compute=0')).toBe(false);
    expect(hasNoGpuComputeParam('?no_gpu_compute=false')).toBe(false);
  });
});

describe('isGpuComputeDisabled', () => {
  it('is disabled when the setting is off, whatever the URL says', () => {
    expect(isGpuComputeDisabled(false, '')).toBe(true);
  });

  it('falls through to the URL flag when the setting is on', () => {
    expect(isGpuComputeDisabled(true, '?no_gpu_compute')).toBe(true);
    expect(isGpuComputeDisabled(true, '')).toBe(false);
  });

  it('reads window.location.search when no search string is given', () => {
    expect(isGpuComputeDisabled()).toBe(false);
  });
});
