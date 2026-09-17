/*
 * Straight transliterations of `app/lib/gpuChores/cpuJobs.ts`.
 *
 * These are the goldens: the JS tier is the correctness reference for the whole
 * kit, so the native kernels are checked against a line-for-line port of it
 * rather than against hand-written expected values. Keep these functions dumb —
 * if one of them starts looking clever, it has stopped being a reference.
 */
#ifndef CHORES_REFERENCE_H
#define CHORES_REFERENCE_H

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <vector>

namespace reference {

/** `Uint8ClampedArray` element conversion: clamp to 0..255, ties to even. */
inline uint8_t ClampU8(double value) {
  if (!(value > 0.0)) return 0;  // also catches NaN
  if (value >= 255.0) return 255;
  const double floored = std::floor(value);
  const double fraction = value - floored;
  double rounded = floored;
  if (fraction > 0.5) rounded = floored + 1.0;
  else if (fraction == 0.5) rounded = (std::fmod(floored, 2.0) == 0.0) ? floored : floored + 1.0;
  return static_cast<uint8_t>(rounded);
}

inline double LumaBt709(double r, double g, double b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

inline int LumaBin(double luma) {
  const int bin = static_cast<int>(std::floor(luma + 0.5));  // Math.round
  if (bin < 0) return 0;
  return bin > 255 ? 255 : bin;
}

inline std::vector<uint32_t> LumaHistogram(const std::vector<uint8_t>& rgba, uint32_t pixels) {
  std::vector<uint32_t> bins(256, 0u);
  for (uint32_t i = 0; i < pixels * 4u; i += 4u) {
    bins[LumaBin(LumaBt709(rgba[i], rgba[i + 1], rgba[i + 2]))] += 1u;
  }
  return bins;
}

inline std::vector<uint8_t> Downsample2d(const std::vector<uint8_t>& src, uint32_t src_width,
                                         uint32_t src_height, uint32_t width, uint32_t height) {
  std::vector<uint8_t> out(static_cast<size_t>(width) * height * 4u, 0u);
  const double x_ratio = static_cast<double>(src_width) / width;
  const double y_ratio = static_cast<double>(src_height) / height;

  for (uint32_t y = 0; y < height; ++y) {
    const uint32_t y0 = static_cast<uint32_t>(std::floor(y * y_ratio));
    const double y_ceil = std::min(static_cast<double>(src_height), std::ceil((y + 1) * y_ratio));
    const uint32_t y1 = std::max(y0 + 1u, static_cast<uint32_t>(y_ceil));
    for (uint32_t x = 0; x < width; ++x) {
      const uint32_t x0 = static_cast<uint32_t>(std::floor(x * x_ratio));
      const double x_ceil = std::min(static_cast<double>(src_width), std::ceil((x + 1) * x_ratio));
      const uint32_t x1 = std::max(x0 + 1u, static_cast<uint32_t>(x_ceil));
      double r = 0, g = 0, b = 0, a = 0;
      uint32_t count = 0;
      for (uint32_t sy = y0; sy < y1; ++sy) {
        for (uint32_t sx = x0; sx < x1; ++sx) {
          const size_t i = (static_cast<size_t>(sy) * src_width + sx) * 4u;
          r += src[i];
          g += src[i + 1];
          b += src[i + 2];
          a += src[i + 3];
          count += 1u;
        }
      }
      const size_t o = (static_cast<size_t>(y) * width + x) * 4u;
      out[o] = ClampU8(r / count);
      out[o + 1] = ClampU8(g / count);
      out[o + 2] = ClampU8(b / count);
      out[o + 3] = ClampU8(a / count);
    }
  }
  return out;
}

inline std::vector<uint8_t> LutU8Map(const std::vector<uint8_t>& src, const uint8_t lut[256]) {
  std::vector<uint8_t> out(src.size(), 0u);
  for (size_t i = 0; i < src.size(); i += 4u) {
    out[i] = lut[src[i]];
    out[i + 1] = lut[src[i + 1]];
    out[i + 2] = lut[src[i + 2]];
    out[i + 3] = src[i + 3];
  }
  return out;
}

}  // namespace reference

#endif  // CHORES_REFERENCE_H
