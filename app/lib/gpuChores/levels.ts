import { HISTOGRAM_BINS, type HistogramResult } from './types';

/** Mean luma of the shipped background plates; the scrim is tuned around it. */
export const SCRIM_REFERENCE_LUMA = 0.11;
/** Vignette strength at the reference luma — the value the CSS shipped with. */
export const SCRIM_BASE_OPACITY = 0.55;
export const SCRIM_MIN_OPACITY = 0.4;
export const SCRIM_MAX_OPACITY = 0.78;

const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

/** Luma (0..1) at the given cumulative fraction of the histogram. */
export function histogramPercentile(histogram: HistogramResult, fraction: number): number {
  if (histogram.total <= 0) return 0;
  const target = clamp(fraction, 0, 1) * histogram.total;
  let seen = 0;
  for (let bin = 0; bin < HISTOGRAM_BINS; bin += 1) {
    const count = histogram.bins[bin];
    seen += count;
    // Empty bins are skipped so a 0 fraction reports the darkest occupied bin
    // rather than bin 0 by default.
    if (count > 0 && seen >= target) return bin / (HISTOGRAM_BINS - 1);
  }
  return 1;
}

/**
 * Scrim opacity for a plate's luma. Brighter plates get a heavier vignette so the
 * breath countdown keeps its contrast; darker plates are left alone.
 */
export function scrimOpacityForLuma(luma: number): number {
  return clamp(
    SCRIM_BASE_OPACITY + (luma - SCRIM_REFERENCE_LUMA) * 1.6,
    SCRIM_MIN_OPACITY,
    SCRIM_MAX_OPACITY,
  );
}

export interface EnvironmentLevels {
  meanLuma: number;
  /** 95th-percentile luma — how hot the plate's highlights are. */
  highlightLuma: number;
  scrimOpacity: number;
}

/** Turn a chore histogram into the levels the background layer actually uses. */
export function deriveEnvironmentLevels(histogram: HistogramResult): EnvironmentLevels {
  const highlightLuma = histogramPercentile(histogram, 0.95);
  // Highlights matter for readability, but should not dominate a dark plate
  // with one candle flame in it.
  const weighted = histogram.meanLuma * 0.7 + highlightLuma * 0.3;
  return {
    meanLuma: histogram.meanLuma,
    highlightLuma,
    scrimOpacity: scrimOpacityForLuma(weighted),
  };
}
