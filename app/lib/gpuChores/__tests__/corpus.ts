/**
 * The seeded differential-fuzz corpus — a line-for-line port of
 * `native/gpu-chores-wasm/testhost/corpus.h` (read its header for the spec).
 *
 * `CORPUS_DIGEST` is asserted on both sides, so the host C++ gate and the
 * vitest run provably exercise the same inputs. Change the generator in one
 * place and the digest moves in both: update them together.
 */

export const CORPUS_CASES = 400;
export const CORPUS_DIGEST = 0xbf69d59a;

const SPECIAL_DIMS = [1, 2, 3, 5, 7, 8, 9, 15, 16, 17, 31, 33, 63, 65] as const;

class Rng {
  private state: number;
  constructor(seed: number) {
    this.state = (seed >>> 0) !== 0 ? seed >>> 0 : 0x9e3779b9;
  }
  next(): number {
    let x = this.state;
    x = (x ^ (x << 13)) >>> 0;
    x = (x ^ (x >>> 17)) >>> 0;
    x = (x ^ (x << 5)) >>> 0;
    this.state = x;
    return x;
  }
  byte(): number {
    return this.next() & 0xff;
  }
}

export interface CorpusCase {
  index: number;
  w: number;
  h: number;
  dw: number;
  dh: number;
  mode: number;
  image: Uint8ClampedArray;
  lut: Uint8Array;
}

function dim(rng: Rng): number {
  const r = rng.next();
  return (r & 1) !== 0 ? SPECIAL_DIMS[(r >>> 1) % 14] : 1 + ((r >>> 1) % 48);
}

export function makeCase(index: number): CorpusCase {
  const seed = (0x1000 + index) >>> 0;
  const rng = new Rng(seed);
  const w = dim(rng);
  const h = dim(rng);
  const dw = 1 + (rng.next() % (2 * w + 3));
  const dh = 1 + (rng.next() % (2 * h + 3));
  const mode = rng.next() % 4;

  const image = new Uint8ClampedArray(w * h * 4);
  const pixels = new Rng(seed ^ 0x5bd1e995);
  for (let i = 0; i < image.length; i += 1) {
    if (mode === 0) image[i] = pixels.byte();
    else if (mode === 1) image[i] = 0x00;
    else if (mode === 2) image[i] = 0xff;
    else image[i] = 10 + (i & 1);
  }

  const lut = new Uint8Array(256);
  const lutRng = new Rng(seed ^ 0x1b873593);
  for (let i = 0; i < lut.length; i += 1) lut[i] = lutRng.byte();

  return { index, w, h, dw, dh, mode, image, lut };
}

/** FNV-1a 32 over every case's dims, image and lut — identical to `corpus::Digest()`. */
export function corpusDigest(): number {
  let h = 0x811c9dc5;
  const byte = (b: number) => {
    h = Math.imul(h ^ (b & 0xff), 0x01000193) >>> 0;
  };
  const u32 = (v: number) => {
    for (let i = 0; i < 4; i += 1) byte((v >>> (8 * i)) & 0xff);
  };
  for (let i = 0; i < CORPUS_CASES; i += 1) {
    const c = makeCase(i);
    u32(c.w); u32(c.h); u32(c.dw); u32(c.dh);
    for (const b of c.image) byte(b);
    for (const b of c.lut) byte(b);
  }
  return h >>> 0;
}
