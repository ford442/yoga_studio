import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCRIM_MAX_OPACITY, scrimOpacityForLuma } from '../../lib/gpuChores';
import { useEnvironmentLevels, staticLevels } from '../useEnvironmentLevels';

/**
 * `createImageBitmap` is stubbed with packed RGBA bytes, which the chores kit
 * accepts directly — jsdom has no Canvas2D to decode a real bitmap through.
 */
const stubBitmap = (fill: number, width = 64, height = 32) => ({
  data: new Uint8ClampedArray(width * height * 4).fill(fill),
  width,
  height,
  close: vi.fn(),
});

let bitmap = stubBitmap(255);

beforeEach(() => {
  bitmap = stubBitmap(255);
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => ({}) })));
  vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap));
  vi.stubGlobal('requestIdleCallback', undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useEnvironmentLevels', () => {
  it('starts from the plate’s baked average luminance', () => {
    const { result } = renderHook(() => useEnvironmentLevels('backgrounds/zendo-dawn-16x9.jpg', 0.1041));

    expect(result.current).toEqual(staticLevels(0.1041));
    expect(result.current.scrimOpacity).toBeCloseTo(scrimOpacityForLuma(0.1041), 6);
  });

  it('replaces the baked value with the measured levels', async () => {
    const { result } = renderHook(() => useEnvironmentLevels('backgrounds/temple-dawn-16x9.jpg', 0.05));

    await waitFor(() => expect(result.current.meanLuma).toBeGreaterThan(0.9));
    expect(result.current.scrimOpacity).toBe(SCRIM_MAX_OPACITY);
    expect(bitmap.close).toHaveBeenCalled();
  });

  it('measures nothing without an image source', () => {
    const { result } = renderHook(() => useEnvironmentLevels(undefined, 0.2));

    expect(result.current).toEqual(staticLevels(0.2));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps the baked value when the plate cannot be fetched', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));

    const { result } = renderHook(() => useEnvironmentLevels('backgrounds/missing.jpg', 0.3));

    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(result.current).toEqual(staticLevels(0.3));
  });
});
