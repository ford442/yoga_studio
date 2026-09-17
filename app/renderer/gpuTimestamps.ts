/**
 * GPU pass timing via `timestamp-query`.
 *
 * The CPU governor can only see how long the JS frame took — React commit,
 * `writeBuffer`, the WebGL2 overlay on its second canvas, video decode and GC
 * all land in the same number. This module reads the GPU's own clock around
 * the render passes so the governor can tell "the shader is 18ms deep" from
 * "the instructor video hitched".
 *
 * Contract:
 * - Optional. `createGpuFrameTimer` returns null when the device does not
 *   carry the feature (Safari/Firefox today); the caller keeps CPU timing.
 * - Never blocks the breath loop: `mapAsync` is fire-and-forget and at most
 *   one readback is in flight, sampled every `READBACK_INTERVAL_FRAMES`.
 * - Device loss destroys the query set; a destroyed timer reports nothing.
 */

/** scene begin/end + one auxiliary pass (overlay or compute) begin/end. */
export const TIMESTAMP_QUERY_SLOTS = 4;

/** Sample one frame in N. Cheap enough to be honest, rare enough to never stall. */
export const READBACK_INTERVAL_FRAMES = 12;

const NS_PER_MS = 1_000_000;
const BYTES_PER_TIMESTAMP = 8;
const RESOLVE_BYTES = TIMESTAMP_QUERY_SLOTS * BYTES_PER_TIMESTAMP;

/** A single timestamp value can be 0 (unwritten) or wrap; ignore anything absurd. */
const MAX_PLAUSIBLE_PASS_MS = 1000;

export type GpuTimestampStatus = 'on' | 'unsupported' | 'off';

export interface GpuFrameTimer {
  /**
   * Call once per frame before encoding. Returns true when this frame is being
   * sampled — the caller should then attach `sceneWrites()` / `auxWrites()`
   * and call `resolve()` + `readback()`.
   */
  beginFrame(): boolean;
  /** `timestampWrites` for the main scene pass, or undefined when not sampling. */
  sceneWrites(): GPURenderPassTimestampWrites | undefined;
  /** `timestampWrites` for an optional second pass (overlay / compute). */
  auxWrites(): GPURenderPassTimestampWrites | undefined;
  /** Encode the resolve + staging copy. Safe to call when not sampling (no-op). */
  resolve(encoder: GPUCommandEncoder): void;
  /** Kick the async map. Never awaited by the render loop. */
  readback(): void;
  /** Most recent GPU pass time in ms (scene + aux), or null before the first readback. */
  lastGpuPassMs(): number | null;
  status(): GpuTimestampStatus;
  destroy(): void;
}

/** True when this device actually enabled the feature. */
export function supportsTimestampQuery(device: Pick<GPUDevice, 'features'>): boolean {
  try {
    return Boolean(device.features?.has('timestamp-query'));
  } catch {
    return false;
  }
}

/**
 * Build a frame timer for `device`, or null when the feature is absent or the
 * query set cannot be created. Callers treat null as "keep CPU timing".
 */
export function createGpuFrameTimer(device: GPUDevice): GpuFrameTimer | null {
  if (!supportsTimestampQuery(device)) return null;
  if (typeof device.createQuerySet !== 'function') return null;

  let querySet: GPUQuerySet | null = null;
  let resolveBuffer: GPUBuffer | null = null;
  let staging: GPUBuffer | null = null;

  try {
    querySet = device.createQuerySet({
      label: 'Sacred Breath Frame Timestamps',
      type: 'timestamp',
      count: TIMESTAMP_QUERY_SLOTS,
    });
    resolveBuffer = device.createBuffer({
      label: 'Sacred Breath Timestamp Resolve',
      size: RESOLVE_BYTES,
      usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
    });
    staging = device.createBuffer({
      label: 'Sacred Breath Timestamp Readback',
      size: RESOLVE_BYTES,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
  } catch (error) {
    console.warn('[WebGPU] timestamp query set unavailable:', error);
    try { querySet?.destroy(); } catch { /* nothing to clean */ }
    try { resolveBuffer?.destroy(); } catch { /* nothing to clean */ }
    try { staging?.destroy(); } catch { /* nothing to clean */ }
    return null;
  }

  let destroyed = false;
  let frameCount = 0;
  let sampling = false;
  let auxSampled = false;
  let pendingAux = false;
  let inFlight = false;
  let lastMs: number | null = null;

  const disable = (reason: string, error?: unknown): void => {
    if (!destroyed) console.warn(`[WebGPU] GPU timestamps disabled: ${reason}`, error ?? '');
    destroyed = true;
    sampling = false;
    inFlight = false;
    try { querySet?.destroy(); } catch { /* already gone */ }
    try { resolveBuffer?.destroy(); } catch { /* already gone */ }
    try { staging?.destroy(); } catch { /* already gone */ }
    querySet = null;
    resolveBuffer = null;
    staging = null;
  };

  const readPair = (view: BigUint64Array, begin: number, end: number): number | null => {
    const a = view[begin];
    const b = view[end];
    if (a === undefined || b === undefined) return null;
    if (a === 0n || b === 0n || b <= a) return null;
    const ms = Number(b - a) / NS_PER_MS;
    return Number.isFinite(ms) && ms >= 0 && ms < MAX_PLAUSIBLE_PASS_MS ? ms : null;
  };

  return {
    beginFrame() {
      if (destroyed) return false;
      frameCount += 1;
      // One readback at a time — a slow map must never make frames pile up.
      sampling = !inFlight && frameCount % READBACK_INTERVAL_FRAMES === 0;
      auxSampled = false;
      pendingAux = false;
      return sampling;
    },

    sceneWrites() {
      if (!sampling || !querySet) return undefined;
      return { querySet, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 };
    },

    auxWrites() {
      if (!sampling || !querySet) return undefined;
      pendingAux = true;
      return { querySet, beginningOfPassWriteIndex: 2, endOfPassWriteIndex: 3 };
    },

    resolve(encoder) {
      if (!sampling || destroyed || !querySet || !resolveBuffer || !staging) return;
      try {
        encoder.resolveQuerySet(querySet, 0, TIMESTAMP_QUERY_SLOTS, resolveBuffer, 0);
        encoder.copyBufferToBuffer(resolveBuffer, 0, staging, 0, RESOLVE_BYTES);
        auxSampled = pendingAux;
      } catch (error) {
        disable('resolveQuerySet failed', error);
      }
    },

    readback() {
      if (!sampling || destroyed || inFlight || !staging) return;
      const buffer = staging;
      inFlight = true;
      sampling = false;
      const sampledAux = auxSampled;
      let mapped: Promise<undefined> | undefined;
      try {
        mapped = buffer.mapAsync(GPUMapMode.READ, 0, RESOLVE_BYTES) as Promise<undefined>;
      } catch (error) {
        inFlight = false;
        disable('mapAsync threw', error);
        return;
      }
      void Promise.resolve(mapped)
        .then(() => {
          if (destroyed) return;
          const view = new BigUint64Array(buffer.getMappedRange(0, RESOLVE_BYTES).slice(0));
          const scene = readPair(view, 0, 1);
          const aux = sampledAux ? readPair(view, 2, 3) : null;
          if (scene != null) lastMs = scene + (aux ?? 0);
        })
        .catch(() => {
          // A lost/destroyed device rejects the map; stop sampling rather than
          // spamming the console every interval.
          if (!destroyed) disable('readback rejected (device lost?)');
        })
        .finally(() => {
          try { buffer.unmap(); } catch { /* already unmapped / destroyed */ }
          inFlight = false;
        });
    },

    lastGpuPassMs() {
      return destroyed ? null : lastMs;
    },

    status() {
      return destroyed ? 'off' : 'on';
    },

    destroy() {
      destroyed = true;
      sampling = false;
      try { querySet?.destroy(); } catch { /* already gone */ }
      try { resolveBuffer?.destroy(); } catch { /* already gone */ }
      try { staging?.destroy(); } catch { /* already gone */ }
      querySet = null;
      resolveBuffer = null;
      staging = null;
    },
  };
}
