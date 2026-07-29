import { describe, expect, it } from 'vitest';
import { getWebGPUAdapterOptions } from '../adapterOptions';

describe('getWebGPUAdapterOptions', () => {
  it.each([
    ['performance', 'low-power'],
    ['auto', 'high-performance'],
    ['quality', 'high-performance'],
  ] as const)('maps %s mode to %s', (mode, powerPreference) => {
    expect(getWebGPUAdapterOptions(mode)).toEqual({
      powerPreference,
      forceFallbackAdapter: false,
    });
  });
});
