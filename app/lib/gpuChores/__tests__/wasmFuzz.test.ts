import { beforeAll, describe, expect, it } from 'vitest';
import { downsample2dCpu, lumaHistogramCpu, lutU8MapCpu } from '../cpuJobs';
import { loadChoresWasm, type ChoresWasm } from '../wasm/choresModule';
import { downsample2dWasm, lumaHistogramWasm, lutU8MapWasm } from '../wasmJobs';
import { CORPUS_CASES, CORPUS_DIGEST, corpusDigest, makeCase } from './corpus';

/**
 * Differential fuzz of the *shipped* `chores.wasm` against the JS tier, over the
 * same seeded corpus the host C++ gate runs against its references
 * (`native/gpu-chores-wasm/testhost/kernels_test.cpp`). The C++ gate finds
 * kernel bugs; this one finds build / toolchain / marshalling bugs in the
 * artifact that actually ships.
 */

/** Cheap equality: `toEqual` on large typed arrays is far slower than a loop. */
function same(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

let wasm: ChoresWasm;

beforeAll(async () => {
  const loaded = await loadChoresWasm();
  if (!loaded.module) throw new Error(`wasm did not load: ${loaded.reason}`);
  wasm = loaded.module;
});

describe('wasm differential fuzz corpus', () => {
  it('is the very corpus the host C++ gate asserts', () => {
    expect(corpusDigest()).toBe(CORPUS_DIGEST);
  });

  it('matches the JS reference on every case: histogram, downsample, lut', () => {
    for (let index = 0; index < CORPUS_CASES; index += 1) {
      const c = makeCase(index);
      const source = { data: c.image, width: c.w, height: c.h };
      const where = `corpus case ${index} (${c.w}x${c.h} -> ${c.dw}x${c.dh}, mode ${c.mode})`;

      const hist = lumaHistogramWasm(wasm, source);
      const histWant = lumaHistogramCpu(source);
      expect(same(hist.bins, histWant.bins), `histogram, ${where}`).toBe(true);
      expect(hist.total, where).toBe(histWant.total);

      const down = downsample2dWasm(wasm, source, c.dw, c.dh);
      const downWant = downsample2dCpu(source, c.dw, c.dh);
      expect(same(down.data, downWant.data), `downsample, ${where}`).toBe(true);

      const lut = lutU8MapWasm(wasm, source, c.lut);
      const lutWant = lutU8MapCpu(source, c.lut);
      expect(same(lut.data, lutWant.data), `lut, ${where}`).toBe(true);
    }
  });
});
