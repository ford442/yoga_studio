/*
 * The seeded differential-fuzz corpus, shared with the TypeScript suite.
 *
 * `app/lib/gpuChores/__tests__/corpus.ts` implements the *same* generator, and
 * both sides assert the same digest over the generated inputs (kCorpusDigest),
 * so "the C++ host gate and the vitest run exercise the identical corpus" is
 * checked, not assumed. Change anything here and the digest moves: update it in
 * both files together.
 *
 * Spec (all arithmetic is uint32, wrapping):
 *   Rng        xorshift32: x ^= x << 13; x ^= x >> 17; x ^= x << 5
 *   seed_i     0x1000 + i, for i in [0, kCorpusCases)
 *   dim(rng)   r = next(); (r & 1) ? kSpecialDims[(r >> 1) % 14] : 1 + (r >> 1) % 48
 *   case       w = dim, h = dim, dw = 1 + next() % (2w + 3), dh = 1 + next() % (2h + 3),
 *              mode = next() % 4          (all from Rng(seed_i), in that order)
 *   image      w*h*4 bytes. mode 0: Rng(seed_i ^ 0x5bd1e995).byte() each;
 *              mode 1: 0x00; mode 2: 0xFF; mode 3: 10 + (index & 1)  (half-way ties)
 *   lut        256 bytes from Rng(seed_i ^ 0x1b873593).byte() each
 *   digest     FNV-1a 32 over, per case: w, h, dw, dh as 4 LE bytes each, the
 *              image bytes, then the lut bytes
 */
#ifndef CHORES_CORPUS_H
#define CHORES_CORPUS_H

#include <cstddef>
#include <cstdint>
#include <vector>

namespace corpus {

constexpr uint32_t kCorpusCases = 400;
constexpr uint32_t kCorpusDigest = 0xBF69D59Au;

struct Rng {
  uint32_t state;
  explicit Rng(uint32_t seed) : state(seed != 0u ? seed : 0x9E3779B9u) {}
  uint32_t next() {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return state;
  }
  uint8_t byte() { return static_cast<uint8_t>(next() & 0xFFu); }
};

struct Case {
  uint32_t index = 0;
  uint32_t w = 0, h = 0, dw = 0, dh = 0, mode = 0;
  std::vector<uint8_t> image;  // w * h * 4
  std::vector<uint8_t> lut;    // 256
};

inline uint32_t Dim(Rng& rng) {
  static const uint32_t kSpecialDims[14] = {1, 2, 3, 5, 7, 8, 9, 15, 16, 17, 31, 33, 63, 65};
  const uint32_t r = rng.next();
  return (r & 1u) != 0u ? kSpecialDims[(r >> 1) % 14u] : 1u + (r >> 1) % 48u;
}

inline Case MakeCase(uint32_t index) {
  const uint32_t seed = 0x1000u + index;
  Rng rng(seed);
  Case c;
  c.index = index;
  c.w = Dim(rng);
  c.h = Dim(rng);
  c.dw = 1u + rng.next() % (2u * c.w + 3u);
  c.dh = 1u + rng.next() % (2u * c.h + 3u);
  c.mode = rng.next() % 4u;

  c.image.resize(static_cast<size_t>(c.w) * c.h * 4u);
  Rng pixels(seed ^ 0x5bd1e995u);
  for (size_t i = 0; i < c.image.size(); ++i) {
    switch (c.mode) {
      case 0: c.image[i] = pixels.byte(); break;
      case 1: c.image[i] = 0x00; break;
      case 2: c.image[i] = 0xFF; break;
      default: c.image[i] = static_cast<uint8_t>(10u + (i & 1u)); break;
    }
  }
  c.lut.resize(256);
  Rng lut(seed ^ 0x1b873593u);
  for (uint8_t& entry : c.lut) entry = lut.byte();
  return c;
}

struct Fnv {
  uint32_t h = 0x811C9DC5u;
  void Byte(uint8_t b) { h = (h ^ b) * 0x01000193u; }
  void U32(uint32_t v) {
    for (int i = 0; i < 4; ++i) Byte(static_cast<uint8_t>((v >> (8 * i)) & 0xFFu));
  }
};

inline uint32_t Digest() {
  Fnv fnv;
  for (uint32_t i = 0; i < kCorpusCases; ++i) {
    const Case c = MakeCase(i);
    fnv.U32(c.w); fnv.U32(c.h); fnv.U32(c.dw); fnv.U32(c.dh);
    for (const uint8_t b : c.image) fnv.Byte(b);
    for (const uint8_t b : c.lut) fnv.Byte(b);
  }
  return fnv.h;
}

}  // namespace corpus

#endif  // CHORES_CORPUS_H
