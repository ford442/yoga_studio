#include "api.h"

#include "simd.h"

/*
 * A 256-entry map is a gather, and wasm128 has no gather: `i8x16.swizzle` only
 * indexes 16 lanes, so covering 256 entries would cost 16 swizzle+select pairs
 * per 16 bytes — more work than the scalar loads it replaces. So the LUT kernel
 * stays scalar and instead earns its keep by assembling whole pixels as 32-bit
 * words, which halves the store traffic against the JS byte-at-a-time version.
 */

extern "C" chores_status_t chores_lut_u8_map(const uint8_t* src, uint32_t pixel_count,
                                              const uint8_t* lut, uint8_t* dst) {
  if (src == nullptr || dst == nullptr || lut == nullptr) return CHORES_ERR_NULL;
  if (pixel_count == 0u) return CHORES_ERR_EMPTY;
  if (pixel_count > 0xFFFFFFFFu / 4u) return CHORES_ERR_OVERFLOW;

  for (uint32_t i = 0; i < pixel_count; ++i) {
    const uint8_t* p = src + static_cast<size_t>(i) * 4u;
    // Alpha passes through untouched — grading the alpha channel would punch
    // holes in a plate the compositor expects to be opaque.
    const uint8_t pixel[4] = {lut[p[0]], lut[p[1]], lut[p[2]], p[3]};
    __builtin_memcpy(dst + static_cast<size_t>(i) * 4u, pixel, 4u);
  }
  return CHORES_OK;
}
