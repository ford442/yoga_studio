import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { downsample2dCpu, lumaHistogramCpu, lutU8MapCpu } from '../cpuJobs';
import type { Rgba8Image } from '../types';
import {
  CHORES_WASM_ABI_VERSION,
  loadChoresWasm,
  resetChoresWasmForTests,
  type ChoresWasm,
} from '../wasm/choresModule';
import { CHORES_WASM_BASE64, CHORES_WASM_BYTES } from '../wasm/choresWasmBinary';
import { downsample2dWasm, lumaHistogramWasm, lutU8MapWasm } from '../wasmJobs';

/**
 * These are the JS side of the goldens: the host C++ suite
 * (`native/gpu-chores-wasm/testhost`) checks the kernels against a port of
 * `cpuJobs.ts`, and this file checks the *shipped wasm* against `cpuJobs.ts`
 * itself, through the same marshalling the app uses. Neither gate is redundant
 * — the C++ one catches kernel bugs, this one catches build and glue bugs.
 */

/** Deterministic noise: a failure here should reproduce from the seed alone. */
function noise(width: number, height: number, seed: number): Rgba8Image {
  let state = seed || 1;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    data[i] = state & 0xff;
  }
  return { data, width, height };
}

let wasm: ChoresWasm;

beforeAll(async () => {
  const loaded = await loadChoresWasm();
  // If this throws, the committed .wasm is broken — no point running the rest.
  if (!loaded.module) throw new Error(`wasm did not load: ${loaded.reason}`);
  wasm = loaded.module;
});

describe('the committed wasm artifact', () => {
  it('matches the base64 module beside it', () => {
    // `chores.wasm` is the real artifact and `choresWasmBinary.ts` is what ships;
    // a half-run of `npm run build:chores-wasm` would leave them disagreeing.
    const wasmPath = path.resolve(__dirname, '../wasm/chores.wasm');
    const onDisk = readFileSync(wasmPath);

    expect(onDisk.byteLength).toBe(CHORES_WASM_BYTES);
    expect(onDisk.toString('base64')).toBe(CHORES_WASM_BASE64);
    expect(onDisk.subarray(0, 4)).toEqual(Buffer.from([0x00, 0x61, 0x73, 0x6d]));
  });

  it('is built with SIMD and speaks the ABI the loader expects', () => {
    expect(wasm.exports.chores_abi_version()).toBe(CHORES_WASM_ABI_VERSION);
    expect(wasm.hasSimd).toBe(true);
  });

  it('is memoised across calls', async () => {
    const first = await loadChoresWasm();
    const second = await loadChoresWasm();
    expect(second.module).toBe(first.module);
  });

  it('reports a reason instead of throwing when WebAssembly is missing', async () => {
    const original = globalThis.WebAssembly;
    resetChoresWasmForTests();
    try {
      // @ts-expect-error - deliberately removing the global for this case.
      delete globalThis.WebAssembly;
      const load = await loadChoresWasm();
      expect(load.module).toBeNull();
      expect(load.reason).toBe('WebAssembly unavailable');
    } finally {
      globalThis.WebAssembly = original;
      resetChoresWasmForTests();
    }
  });
});

describe('the arena', () => {
  it('reuses its space rather than growing per job', () => {
    wasm.reset();
    const first = wasm.alloc(1024);
    expect(wasm.exports.chores_arena_used()).toBeGreaterThanOrEqual(1024);

    wasm.reset();
    expect(wasm.exports.chores_arena_used()).toBe(0);
    expect(wasm.alloc(1024)).toBe(first);
  });

  it('refuses a zero-byte reservation instead of handing back null', () => {
    expect(() => wasm.alloc(0)).toThrow(/arena refused/);
  });
});

describe('lumaHistogramWasm', () => {
  it('agrees with the JS golden bin for bin', () => {
    for (const seed of [3, 91, 2024]) {
      const image = noise(53, 29, seed);
      const got = lumaHistogramWasm(wasm, image);
      const want = lumaHistogramCpu(image);

      expect(Array.from(got.bins)).toEqual(Array.from(want.bins));
      expect(got.total).toBe(want.total);
      expect(got.meanLuma).toBe(want.meanLuma);
    }
  });

  it('handles an empty image without touching the arena', () => {
    const result = lumaHistogramWasm(wasm, { data: new Uint8ClampedArray(0), width: 0, height: 0 });
    expect(result.total).toBe(0);
    expect(result.meanLuma).toBe(0);
    expect(result.bins).toHaveLength(256);
  });
});

describe('downsample2dWasm', () => {
  it('agrees with the JS area-average golden byte for byte', () => {
    const cases: Array<[number, number, number, number]> = [
      [64, 64, 16, 16],
      [193, 121, 128, 72], // a plate-shaped source down to the levels thumb
      [17, 5, 5, 3],
      [8, 8, 8, 8],
    ];
    for (const [sw, sh, dw, dh] of cases) {
      const image = noise(sw, sh, sw * 31 + dh);
      expect(Array.from(downsample2dWasm(wasm, image, dw, dh).data)).toEqual(
        Array.from(downsample2dCpu(image, dw, dh).data),
      );
    }
  });

  it('returns a copy, not a view into linear memory', () => {
    const image = noise(16, 16, 11);
    const first = downsample2dWasm(wasm, image, 4, 4);
    const snapshot = Array.from(first.data);

    // A later job reuses the same arena bytes; the earlier result must not move.
    downsample2dWasm(wasm, noise(16, 16, 12), 4, 4);
    expect(Array.from(first.data)).toEqual(snapshot);
  });
});

describe('lutU8MapWasm', () => {
  it('agrees with the JS golden and leaves alpha alone', () => {
    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i += 1) lut[i] = 255 - i;
    const image = noise(23, 19, 77);

    const got = lutU8MapWasm(wasm, image, lut);
    expect(Array.from(got.data)).toEqual(Array.from(lutU8MapCpu(image, lut).data));
    for (let i = 3; i < got.data.length; i += 4) expect(got.data[i]).toBe(image.data[i]);
  });

  it('rejects a LUT that is not 256 entries, like the JS tier', () => {
    expect(() => lutU8MapWasm(wasm, noise(2, 2, 1), new Uint8Array(16))).toThrow(/256-entry/);
  });
});
