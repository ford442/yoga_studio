import { describe, expect, it } from 'vitest';
import {
  downsample2dCanvas,
  downsample2dCpu,
  hasCanvas2d,
  imageSize,
  isRgba8Image,
  lumaBin,
  lumaBt709,
  lumaHistogramCpu,
  lutU8MapCpu,
  meanLumaFromBins,
  toRgba8,
} from '../cpuJobs';
import type { ChoreImageSource, Rgba8Image } from '../types';

const solid = (width: number, height: number, rgba: [number, number, number, number]): Rgba8Image => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data.set(rgba, i);
  }
  return { data, width, height };
};

describe('lumaBt709', () => {
  it('uses the BT.709 weights on sRGB-encoded channels', () => {
    expect(lumaBt709(255, 255, 255)).toBeCloseTo(255, 6);
    expect(lumaBt709(0, 255, 0)).toBeCloseTo(182.376, 3);
    expect(lumaBt709(0, 0, 0)).toBe(0);
  });

  it('clamps bins to the 256-bin range', () => {
    expect(lumaBin(-4)).toBe(0);
    expect(lumaBin(254.6)).toBe(255);
    expect(lumaBin(999)).toBe(255);
  });
});

describe('lumaHistogramCpu', () => {
  it('puts every pixel of a flat image in one bin', () => {
    const histogram = lumaHistogramCpu(solid(4, 4, [255, 255, 255, 255]));

    expect(histogram.total).toBe(16);
    expect(histogram.bins[255]).toBe(16);
    expect(histogram.meanLuma).toBeCloseTo(1, 6);
  });

  it('splits a two-tone image across two bins', () => {
    const image = solid(2, 2, [0, 0, 0, 255]);
    image.data.set([255, 255, 255, 255], 0);
    const histogram = lumaHistogramCpu(image);

    expect(histogram.bins[0]).toBe(3);
    expect(histogram.bins[255]).toBe(1);
    expect(histogram.meanLuma).toBeCloseTo(0.25, 6);
  });

  it('reports zero mean luma for an empty image', () => {
    expect(meanLumaFromBins(new Uint32Array(256), 0)).toBe(0);
    expect(lumaHistogramCpu(solid(0, 0, [0, 0, 0, 0])).meanLuma).toBe(0);
  });
});

describe('downsample2dCpu', () => {
  it('area-averages each destination footprint', () => {
    const image = solid(2, 2, [0, 0, 0, 255]);
    image.data.set([200, 100, 40, 255], 0);
    const thumb = downsample2dCpu(image, 1, 1);

    expect(thumb.width).toBe(1);
    expect(thumb.height).toBe(1);
    expect(Array.from(thumb.data)).toEqual([50, 25, 10, 255]);
  });

  it('keeps every source pixel when the size is unchanged', () => {
    const image = solid(2, 1, [10, 20, 30, 255]);
    expect(Array.from(downsample2dCpu(image, 2, 1).data)).toEqual(Array.from(image.data));
  });

  it('upsamples by repeating the nearest footprint', () => {
    const image = solid(1, 1, [8, 16, 32, 255]);
    const scaled = downsample2dCpu(image, 2, 2);

    expect(scaled.data.length).toBe(16);
    expect(Array.from(scaled.data.slice(0, 4))).toEqual([8, 16, 32, 255]);
  });
});

describe('downsample2dCanvas', () => {
  it('routes packed bytes through the scalar path', () => {
    const image = solid(2, 2, [12, 24, 36, 255]);
    expect(Array.from(downsample2dCanvas(image, 1, 1).data)).toEqual([12, 24, 36, 255]);
  });
});

describe('lutU8MapCpu', () => {
  it('maps colour channels and passes alpha through', () => {
    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i += 1) lut[i] = 255 - i;
    const mapped = lutU8MapCpu(solid(1, 1, [0, 128, 255, 64]), lut);

    expect(Array.from(mapped.data)).toEqual([255, 127, 0, 64]);
  });

  it('rejects a LUT that is not 256 entries', () => {
    expect(() => lutU8MapCpu(solid(1, 1, [0, 0, 0, 255]), new Uint8Array(16))).toThrow(/256-entry/);
  });
});

describe('source helpers', () => {
  it('recognises packed images and reads their size', () => {
    const image = solid(3, 2, [0, 0, 0, 255]);
    expect(isRgba8Image(image)).toBe(true);
    expect(imageSize(image)).toEqual({ width: 3, height: 2 });
    expect(toRgba8(image)).toBe(image);
  });

  it('reports no Canvas2D tier in an environment without one', () => {
    // jsdom has no 2D context, which is exactly the "JS tier only" case.
    expect(hasCanvas2d()).toBe(false);
  });

  it('throws when pixels can only be read through an unavailable Canvas2D', () => {
    const bitmap = { width: 2, height: 2 } as unknown as ChoreImageSource;
    expect(() => toRgba8(bitmap)).toThrow(/Canvas2D is unavailable/);
  });
});
