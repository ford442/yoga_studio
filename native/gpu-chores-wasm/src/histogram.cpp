#include "api.h"

#include "simd.h"

namespace {

/**
 * Per-channel weight tables in double precision.
 *
 * `cpuJobs.ts` computes `(0.2126 * r + 0.7152 * g) + 0.0722 * b` on IEEE-754
 * doubles. A table entry is the *same* multiplication, precomputed, and the two
 * additions keep the same left-to-right order — so this path is bit-exact with
 * the JS reference rather than merely close to it.
 *
 * This is deliberately not a float32 vector reduction: f32 luma drifts by up to
 * ~2e-3, which is enough to move a pixel sitting near a `.5` bin boundary into
 * the neighbouring bin and break the Chromashift goldens. The histogram is
 * scatter-bound on the bin increment anyway, so the vector version would buy
 * very little for that risk. The vector kernels live in downsample.cpp, where
 * the arithmetic is integral and exactness is free.
 */
struct LumaTables {
  double r[256];
  double g[256];
  double b[256];
};

constexpr double kWeightR = 0.2126;
constexpr double kWeightG = 0.7152;
constexpr double kWeightB = 0.0722;

// Filled on first use rather than emitted as a constant data segment: 6 KiB of
// doubles would be half the shipped module, and the browser can compute them in
// microseconds. Zero-initialised statics cost nothing in the wasm binary.
LumaTables g_tables{};
bool g_tables_ready = false;

const LumaTables& Tables() {
  if (!g_tables_ready) {
    for (int i = 0; i < 256; ++i) {
      g_tables.r[i] = kWeightR * static_cast<double>(i);
      g_tables.g[i] = kWeightG * static_cast<double>(i);
      g_tables.b[i] = kWeightB * static_cast<double>(i);
    }
    g_tables_ready = true;
  }
  return g_tables;
}

/** `Math.round` semantics: half rounds up, then clamp into 0..255. */
inline uint32_t BinFor(double luma) {
  // Luma is a non-negative weighted sum of 0..255 channels, so the plain
  // +0.5 truncation is exactly Math.round here (no negative-half case).
  const int32_t bin = static_cast<int32_t>(luma + 0.5);
  if (bin < 0) return 0u;
  if (bin > static_cast<int32_t>(CHORES_HISTOGRAM_BINS) - 1) return CHORES_HISTOGRAM_BINS - 1u;
  return static_cast<uint32_t>(bin);
}

}  // namespace

extern "C" chores_status_t chores_luma_histogram_bt709(const uint8_t* rgba, uint32_t pixel_count,
                                                       uint32_t* bins) {
  if (rgba == nullptr || bins == nullptr) return CHORES_ERR_NULL;
  for (uint32_t i = 0; i < CHORES_HISTOGRAM_BINS; ++i) bins[i] = 0u;
  if (pixel_count == 0u) return CHORES_ERR_EMPTY;
  if (pixel_count > 0xFFFFFFFFu / 4u) return CHORES_ERR_OVERFLOW;

  const LumaTables& t = Tables();

  // Four shadow tallies keep the dependent-add chain on the bin counters from
  // serialising the loop when neighbouring pixels land in the same bin.
  // Single-threaded by construction: wasm32 without pthreads, and the host test
  // binary runs the kernels serially.
  static uint32_t shadow[4][CHORES_HISTOGRAM_BINS];
  for (uint32_t s = 0; s < 4u; ++s)
    for (uint32_t i = 0; i < CHORES_HISTOGRAM_BINS; ++i) shadow[s][i] = 0u;

  const uint32_t quads = pixel_count & ~3u;
  uint32_t i = 0u;
  for (; i < quads; i += 4u) {
    const uint8_t* p = rgba + static_cast<size_t>(i) * 4u;
    shadow[0][BinFor(t.r[p[0]] + t.g[p[1]] + t.b[p[2]])] += 1u;
    shadow[1][BinFor(t.r[p[4]] + t.g[p[5]] + t.b[p[6]])] += 1u;
    shadow[2][BinFor(t.r[p[8]] + t.g[p[9]] + t.b[p[10]])] += 1u;
    shadow[3][BinFor(t.r[p[12]] + t.g[p[13]] + t.b[p[14]])] += 1u;
  }
  for (; i < pixel_count; ++i) {
    const uint8_t* p = rgba + static_cast<size_t>(i) * 4u;
    shadow[0][BinFor(t.r[p[0]] + t.g[p[1]] + t.b[p[2]])] += 1u;
  }

  for (uint32_t bin = 0; bin < CHORES_HISTOGRAM_BINS; ++bin) {
    bins[bin] = shadow[0][bin] + shadow[1][bin] + shadow[2][bin] + shadow[3][bin];
  }
  return CHORES_OK;
}
