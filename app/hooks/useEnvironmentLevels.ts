'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  SCRIM_REFERENCE_LUMA,
  deriveEnvironmentLevels,
  isGpuComputeDisabled,
  runDownsample2d,
  runLumaHistogram,
  scrimOpacityForLuma,
  type EnvironmentLevels,
} from '../lib/gpuChores';
import { resolveAssetUrl } from '../lib/resolveAssetUrl';
import { createWebGpuChoreExecutor } from '../renderer/gpuChores/webgpuJobs';

/** Thumb size the levels pass works on — small bitmaps only, per the chores kit. */
export const LEVELS_THUMB_WIDTH = 128;
export const LEVELS_THUMB_HEIGHT = 72;

const executor = createWebGpuChoreExecutor();

/** Levels derived from the plate's declared average luminance, used until the chore lands. */
export function staticLevels(averageLuminance?: number): EnvironmentLevels {
  const luma = averageLuminance ?? SCRIM_REFERENCE_LUMA;
  return { meanLuma: luma, highlightLuma: luma, scrimOpacity: scrimOpacityForLuma(luma) };
}

async function measure(url: string, gpuComputeDisabled: boolean): Promise<EnvironmentLevels> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`levels: ${response.status} ${url}`);
  const bitmap = await createImageBitmap(await response.blob());
  try {
    // Full plate → thumb on the GPU (it clears the break-even), then the 128px
    // thumb's histogram on the CPU tier, where a dispatch would not pay off.
    const thumb = await runDownsample2d(bitmap, LEVELS_THUMB_WIDTH, LEVELS_THUMB_HEIGHT, {
      executor,
      gpuComputeDisabled,
    });
    const histogram = await runLumaHistogram(thumb.value, { executor, gpuComputeDisabled });
    return deriveEnvironmentLevels(histogram.value);
  } finally {
    bitmap.close();
  }
}

/**
 * Measures the active background plate through gpu-chores and returns the scrim
 * strength the background layer should use. Falls back to the plate's baked
 * `averageLuminance` whenever the measurement is unavailable (no
 * `createImageBitmap`, offline, or the chore threw).
 */
export function useEnvironmentLevels(
  imageSrc: string | undefined,
  averageLuminance?: number,
  gpuComputeEnabled = true,
): EnvironmentLevels {
  const fallback = useMemo(() => staticLevels(averageLuminance), [averageLuminance]);
  const [measured, setMeasured] = useState<{ src: string; levels: EnvironmentLevels } | null>(null);

  useEffect(() => {
    if (!imageSrc || typeof window === 'undefined' || typeof createImageBitmap !== 'function') return;

    let cancelled = false;
    const disabled = isGpuComputeDisabled(gpuComputeEnabled);
    const run = () => {
      void measure(resolveAssetUrl(imageSrc), disabled)
        .then((levels) => {
          if (!cancelled) setMeasured({ src: imageSrc, levels });
        })
        .catch((error) => {
          console.warn('[gpu-chores] environment levels unavailable:', error);
        });
    };

    // Off the first-paint path: the plate is already fading in with the baked scrim.
    const idle = typeof window.requestIdleCallback === 'function';
    const handle = idle ? window.requestIdleCallback(run) : window.setTimeout(run, 200);

    return () => {
      cancelled = true;
      if (idle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, [imageSrc, gpuComputeEnabled]);

  return measured && measured.src === imageSrc ? measured.levels : fallback;
}
