/**
 * Kill switch for the WebGPU chore tier. Either `?no_gpu_compute` in the URL or
 * the renderer settings toggle forces every chore onto Canvas2D / JS.
 */
export const NO_GPU_COMPUTE_PARAM = 'no_gpu_compute';

export function hasNoGpuComputeParam(search: string): boolean {
  const query = search.startsWith('?') ? search.slice(1) : search;
  if (!query) return false;
  const value = new URLSearchParams(query).get(NO_GPU_COMPUTE_PARAM);
  return value !== null && value !== '0' && value !== 'false';
}

/** True when GPU compute is off, from the URL or the settings-equivalent flag. */
export function isGpuComputeDisabled(settingEnabled = true, search?: string): boolean {
  if (!settingEnabled) return true;
  const query = search ?? (typeof window !== 'undefined' ? window.location.search : '');
  return hasNoGpuComputeParam(query);
}

/**
 * Frame-governor relief valve. When the governor finds the frame CPU-bound it
 * pauses chores rather than dropping resolution — a histogram pass on the main
 * thread costs frames that fewer pixels would never buy back.
 */
let choresPaused = false;

export function setChoresPaused(paused: boolean): void {
  choresPaused = paused;
}

export function areChoresPaused(): boolean {
  return choresPaused;
}
