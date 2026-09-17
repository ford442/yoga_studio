#include "api.h"

#include "simd.h"

namespace {

/**
 * Round `sum / count` the way JS does when it stores into a Uint8ClampedArray:
 * nearest, ties to even.
 *
 * Doing it on the exact rational (quotient + remainder) rather than on a double
 * is both faster and safer — `sum` is an exact integer here, and the only way
 * the double route could disagree is if the true average sat within half an ULP
 * of a `.5` boundary, which needs a box larger than 10^13 pixels.
 */
inline uint8_t AverageRoundHalfEven(uint32_t sum, uint32_t count) {
  const uint32_t quotient = sum / count;
  const uint32_t remainder = sum - quotient * count;
  const uint32_t twice = remainder * 2u;
  uint32_t value = quotient;
  if (twice > count || (twice == count && (quotient & 1u) != 0u)) value += 1u;
  return value > 255u ? uint8_t{255} : static_cast<uint8_t>(value);
}

inline uint32_t FloorU32(double v) { return v <= 0.0 ? 0u : static_cast<uint32_t>(v); }

inline uint32_t CeilU32(double v) {
  const uint32_t floored = FloorU32(v);
  return (static_cast<double>(floored) < v) ? floored + 1u : floored;
}

}  // namespace

extern "C" chores_status_t chores_downsample_2d(const uint8_t* src, uint32_t src_width,
                                                 uint32_t src_height, uint8_t* dst,
                                                 uint32_t dst_width, uint32_t dst_height) {
  if (src == nullptr || dst == nullptr) return CHORES_ERR_NULL;
  if (src_width == 0u || src_height == 0u || dst_width == 0u || dst_height == 0u) {
    return CHORES_ERR_EMPTY;
  }
  // Guard the byte-offset arithmetic below against a 32-bit wrap.
  if (src_width > 0xFFFFu || src_height > 0xFFFFu || dst_width > 0xFFFFu || dst_height > 0xFFFFu) {
    return CHORES_ERR_OVERFLOW;
  }

  // Ratios and span bounds stay in double and in the same order as
  // `downsample2dCpu`, so every box covers exactly the same source pixels.
  const double x_ratio = static_cast<double>(src_width) / static_cast<double>(dst_width);
  const double y_ratio = static_cast<double>(src_height) / static_cast<double>(dst_height);

  for (uint32_t y = 0; y < dst_height; ++y) {
    const uint32_t y0 = FloorU32(static_cast<double>(y) * y_ratio);
    uint32_t y1 = CeilU32(static_cast<double>(y + 1u) * y_ratio);
    if (y1 > src_height) y1 = src_height;
    if (y1 < y0 + 1u) y1 = y0 + 1u;

    for (uint32_t x = 0; x < dst_width; ++x) {
      const uint32_t x0 = FloorU32(static_cast<double>(x) * x_ratio);
      uint32_t x1 = CeilU32(static_cast<double>(x + 1u) * x_ratio);
      if (x1 > src_width) x1 = src_width;
      if (x1 < x0 + 1u) x1 = x0 + 1u;

      // One vector accumulator, four lanes: R, G, B, A. Each source pixel is a
      // single 32-bit load widened to u32 lanes, so the box filter adds a whole
      // pixel per instruction instead of four scalar adds.
      chores::u32x4 acc = chores::zero_u32x4();
      uint32_t count = 0u;
      for (uint32_t sy = y0; sy < y1; ++sy) {
        const uint8_t* row = src + (static_cast<size_t>(sy) * src_width + x0) * 4u;
        for (uint32_t sx = x0; sx < x1; ++sx, row += 4u) {
          acc = chores::add_u32x4(acc, chores::load_rgba_u32x4(row));
          count += 1u;
        }
      }

      uint8_t* out = dst + (static_cast<size_t>(y) * dst_width + x) * 4u;
      out[0] = AverageRoundHalfEven(chores::lane_u32x4(acc, 0), count);
      out[1] = AverageRoundHalfEven(chores::lane_u32x4(acc, 1), count);
      out[2] = AverageRoundHalfEven(chores::lane_u32x4(acc, 2), count);
      out[3] = AverageRoundHalfEven(chores::lane_u32x4(acc, 3), count);
    }
  }
  return CHORES_OK;
}
