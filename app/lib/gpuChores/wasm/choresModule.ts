import { CHORES_WASM_BASE64, CHORES_WASM_BYTES } from './choresWasmBinary';

/**
 * Loader for the native chores kernels (`native/gpu-chores-wasm`).
 *
 * The module is freestanding wasm32 — no Emscripten runtime, no imports at all
 * beyond the memory it exports itself — so instantiation is one call and there
 * is nothing to configure. It is compiled with `-msimd128`, which means an
 * engine without wasm SIMD rejects it at compile time; that rejection is the
 * capability check, and the caller falls through to Canvas2D/JS.
 */

/** Must match `CHORES_ABI_VERSION_VALUE` in `native/gpu-chores-wasm/src/runtime.cpp`. */
export const CHORES_WASM_ABI_VERSION = 1;

/** Status codes from `chores_status_t`. */
export const CHORES_OK = 0;

interface ChoresExports {
  memory: WebAssembly.Memory;
  chores_abi_version(): number;
  chores_has_simd(): number;
  chores_arena_alloc(size: number): number;
  chores_arena_reset(): void;
  chores_arena_used(): number;
  chores_luma_histogram_bt709(rgba: number, pixels: number, bins: number): number;
  chores_downsample_2d(
    src: number, srcWidth: number, srcHeight: number,
    dst: number, dstWidth: number, dstHeight: number,
  ): number;
  chores_lut_u8_map(src: number, pixels: number, lut: number, dst: number): number;
}

export interface ChoresWasm {
  readonly exports: ChoresExports;
  readonly hasSimd: boolean;
  /**
   * Reserve `size` bytes in the module arena. Throws rather than returning 0 so
   * a caller can never hand a null pointer to a kernel.
   */
  alloc(size: number): number;
  /** Drop every reservation. Call once at the top of a job, never mid-job. */
  reset(): void;
  /**
   * A byte view over the arena. Linear memory can be replaced by a growth in
   * `alloc`, which detaches every existing view — so always take the view
   * *after* the last allocation of a job, and never cache one across jobs.
   */
  bytes(pointer: number, length: number): Uint8Array;
  u32(pointer: number, length: number): Uint32Array;
}

function decodeBase64(base64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  // Node (vitest, and any future build-time use of the kernels).
  const nodeBuffer = (globalThis as { Buffer?: { from(s: string, enc: string): Uint8Array } }).Buffer;
  if (nodeBuffer) return nodeBuffer.from(base64, 'base64');
  throw new Error('gpu-chores: no base64 decoder available');
}

function wrap(instance: WebAssembly.Instance): ChoresWasm {
  const exports = instance.exports as unknown as ChoresExports;
  const version = exports.chores_abi_version();
  if (version !== CHORES_WASM_ABI_VERSION) {
    throw new Error(`gpu-chores: wasm ABI ${version}, expected ${CHORES_WASM_ABI_VERSION}`);
  }
  return {
    exports,
    hasSimd: exports.chores_has_simd() === 1,
    alloc(size) {
      const pointer = exports.chores_arena_alloc(size);
      if (pointer === 0) throw new Error(`gpu-chores: wasm arena refused ${size} bytes`);
      return pointer;
    },
    reset() {
      exports.chores_arena_reset();
    },
    bytes(pointer, length) {
      return new Uint8Array(exports.memory.buffer, pointer, length);
    },
    u32(pointer, length) {
      return new Uint32Array(exports.memory.buffer, pointer, length);
    },
  };
}

export interface ChoresWasmLoad {
  module: ChoresWasm | null;
  /** Why the module is unavailable, for the breadcrumb. Empty when it loaded. */
  reason: string;
}

let pending: Promise<ChoresWasmLoad> | null = null;

async function instantiate(): Promise<ChoresWasmLoad> {
  if (typeof WebAssembly === 'undefined' || typeof WebAssembly.instantiate !== 'function') {
    return { module: null, reason: 'WebAssembly unavailable' };
  }
  try {
    const binary = decodeBase64(CHORES_WASM_BASE64);
    if (binary.byteLength !== CHORES_WASM_BYTES) {
      throw new Error(`binary is ${binary.byteLength} bytes, expected ${CHORES_WASM_BYTES}`);
    }
    // `instantiate` over bytes rather than `instantiateStreaming` over a URL:
    // the module is inlined, so there is nothing to fetch and nothing for a
    // `script-src`/`connect-src` CSP to refuse.
    // The ArrayBuffer overload: `binary` is exact-sized, so there is no slice.
    const result = await WebAssembly.instantiate(binary.buffer as ArrayBuffer, {});
    return { module: wrap(result.instance), reason: '' };
  } catch (error) {
    // A CompileError here is the SIMD capability check failing; a CSP without
    // `wasm-unsafe-eval` shows up as a CompileError or an EvalError too. Either
    // way the kit simply has no WASM tier this session.
    const message = error instanceof Error ? error.message : String(error);
    return { module: null, reason: `wasm unavailable (${message})` };
  }
}

/**
 * Load (once) and return the native kernels. Never throws: a failure resolves
 * with `module: null` and the reason the runner puts in its breadcrumb.
 */
export function loadChoresWasm(): Promise<ChoresWasmLoad> {
  pending ??= instantiate();
  return pending;
}

/** Test seam: forget the memoised instance so the next load re-runs. */
export function resetChoresWasmForTests(): void {
  pending = null;
}
