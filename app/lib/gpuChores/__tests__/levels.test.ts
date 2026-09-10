import { describe, expect, it } from 'vitest';
import {
  SCRIM_MAX_OPACITY,
  SCRIM_MIN_OPACITY,
  SCRIM_REFERENCE_LUMA,
  deriveEnvironmentLevels,
  histogramPercentile,
  scrimOpacityForLuma,
} from '../levels';
import { HISTOGRAM_BINS, type HistogramResult } from '../types';

const histogramFrom = (counts: Record<number, number>): HistogramResult => {
  const bins = new Uint32Array(HISTOGRAM_BINS);
  let total = 0;
  let sum = 0;
  for (const [bin, count] of Object.entries(counts)) {
    bins[Number(bin)] = count;
    total += count;
    sum += Number(bin) * count;
  }
  return { bins, total, meanLuma: total > 0 ? sum / total / 255 : 0 };
};

describe('histogramPercentile', () => {
  it('finds the bin holding the requested cumulative fraction', () => {
    const histogram = histogramFrom({ 0: 90, 255: 10 });

    expect(histogramPercentile(histogram, 0.5)).toBe(0);
    expect(histogramPercentile(histogram, 0.95)).toBe(1);
  });

  it('returns zero for an empty histogram', () => {
    expect(histogramPercentile(histogramFrom({}), 0.5)).toBe(0);
  });

  it('clamps out-of-range fractions', () => {
    const histogram = histogramFrom({ 128: 4 });

    expect(histogramPercentile(histogram, -1)).toBeCloseTo(128 / 255, 6);
    expect(histogramPercentile(histogram, 2)).toBeCloseTo(128 / 255, 6);
  });
});

describe('scrimOpacityForLuma', () => {
  it('leaves the reference plate at the shipped strength', () => {
    expect(scrimOpacityForLuma(SCRIM_REFERENCE_LUMA)).toBeCloseTo(0.55, 6);
  });

  it('clamps at both ends', () => {
    expect(scrimOpacityForLuma(0)).toBe(SCRIM_MIN_OPACITY);
    expect(scrimOpacityForLuma(1)).toBe(SCRIM_MAX_OPACITY);
  });
});

describe('deriveEnvironmentLevels', () => {
  it('weighs highlights into the scrim without letting them dominate', () => {
    const dark = deriveEnvironmentLevels(histogramFrom({ 10: 99, 255: 1 }));
    const bright = deriveEnvironmentLevels(histogramFrom({ 200: 100 }));

    expect(dark.meanLuma).toBeLessThan(0.1);
    expect(dark.highlightLuma).toBeCloseTo(10 / 255, 6);
    expect(dark.scrimOpacity).toBeLessThan(bright.scrimOpacity);
    expect(bright.scrimOpacity).toBe(SCRIM_MAX_OPACITY);
  });
});
