/*
 * One thin shim over the two vector ISAs this kernel is built for: wasm128 for
 * the shipped module, SSE2 for the host test binary. Everything else in the
 * kit is plain C++, so this header stays deliberately small — four ops.
 *
 * Neither path changes results: the vector kernels operate on integers, so the
 * scalar tail and the vector body produce identical bytes.
 */
#ifndef CHORES_SIMD_H
#define CHORES_SIMD_H

#include <stddef.h>
#include <stdint.h>

#if defined(__wasm_simd128__)
#define CHORES_SIMD 1
#include <wasm_simd128.h>
namespace chores {
using u32x4 = v128_t;
inline u32x4 zero_u32x4() { return wasm_i32x4_splat(0); }
/** Widen the four bytes at `p` (one RGBA pixel) into four u32 lanes. */
inline u32x4 load_rgba_u32x4(const uint8_t* p) {
  const v128_t bytes = wasm_v128_load32_zero(reinterpret_cast<const int32_t*>(p));
  const v128_t shorts = wasm_u16x8_extend_low_u8x16(bytes);
  return wasm_u32x4_extend_low_u16x8(shorts);
}
// i32x4.add is the only integer add the ISA has; it is bit-identical for
// unsigned lanes, and these sums cannot overflow 32 bits for a sane box size.
inline u32x4 add_u32x4(u32x4 a, u32x4 b) { return wasm_i32x4_add(a, b); }
inline uint32_t lane_u32x4(u32x4 v, int lane) {
  switch (lane) {
    case 0: return wasm_u32x4_extract_lane(v, 0);
    case 1: return wasm_u32x4_extract_lane(v, 1);
    case 2: return wasm_u32x4_extract_lane(v, 2);
    default: return wasm_u32x4_extract_lane(v, 3);
  }
}
}  // namespace chores

#elif defined(__SSE2__)
#define CHORES_SIMD 1
#include <emmintrin.h>
namespace chores {
using u32x4 = __m128i;
inline u32x4 zero_u32x4() { return _mm_setzero_si128(); }
inline u32x4 load_rgba_u32x4(const uint8_t* p) {
  int32_t packed;
  __builtin_memcpy(&packed, p, sizeof(packed));
  const __m128i bytes = _mm_cvtsi32_si128(packed);
  const __m128i shorts = _mm_unpacklo_epi8(bytes, _mm_setzero_si128());
  return _mm_unpacklo_epi16(shorts, _mm_setzero_si128());
}
inline u32x4 add_u32x4(u32x4 a, u32x4 b) { return _mm_add_epi32(a, b); }
inline uint32_t lane_u32x4(u32x4 v, int lane) {
  alignas(16) uint32_t out[4];
  _mm_store_si128(reinterpret_cast<__m128i*>(out), v);
  return out[lane];
}
}  // namespace chores

#else
#define CHORES_SIMD 0
namespace chores {
struct u32x4 {
  uint32_t v[4];
};
inline u32x4 zero_u32x4() { return u32x4{{0u, 0u, 0u, 0u}}; }
inline u32x4 load_rgba_u32x4(const uint8_t* p) {
  return u32x4{{p[0], p[1], p[2], p[3]}};
}
inline u32x4 add_u32x4(u32x4 a, u32x4 b) {
  return u32x4{{a.v[0] + b.v[0], a.v[1] + b.v[1], a.v[2] + b.v[2], a.v[3] + b.v[3]}};
}
inline uint32_t lane_u32x4(u32x4 v, int lane) { return v.v[lane]; }
}  // namespace chores
#endif

#endif  // CHORES_SIMD_H
