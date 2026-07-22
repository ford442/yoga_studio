/** Heuristically pick a quality preset (0=mobile, 1=high) when the caller hasn't pinned one. */
export const resolveQualityPreset = (explicit?: number): number => {
  if (explicit !== undefined) return explicit >= 0.5 ? 1 : 0;
  if (typeof window === 'undefined') return 1;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const highDpr = window.devicePixelRatio >= 2;
  const narrow = window.innerWidth < 900;
  const lowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4;
  const lowCoreCount = navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 6;
  return highDpr || narrow || lowMemory || lowCoreCount ? 0 : 1;
};

/** Cap the device pixel ratio used for the render target based on quality preset. */
export const resolveMaxDpr = (qualityPreset: number, maxDevicePixelRatio?: number): number => {
  if (maxDevicePixelRatio !== undefined) return Math.max(1, maxDevicePixelRatio);
  return qualityPreset < 0.5 ? 1.5 : 2;
};
