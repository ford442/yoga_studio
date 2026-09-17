/*
 * gpu-chores native kernels — stable C ABI.
 *
 * Scope: the numeric mid-tier of the gpu-chores kit (histogram, downsample,
 * LUT). Nothing here knows about the studio, WebGPU, or the DOM.
 *
 * ABI rules (do not relax without bumping CHORES_ABI_VERSION):
 *   - pointer + length only; no STL, no exceptions, no allocation inside a job,
 *   - all buffers are caller-owned and tightly packed (RGBA8, no row padding),
 *   - every entry point returns a chores_status_t and never traps on bad input.
 */
#ifndef CHORES_API_H
#define CHORES_API_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define CHORES_HISTOGRAM_BINS 256u
#define CHORES_LUT_ENTRIES 256u

typedef enum chores_status_t {
  CHORES_OK = 0,
  CHORES_ERR_NULL = 1,
  CHORES_ERR_EMPTY = 2,
  CHORES_ERR_OVERFLOW = 3
} chores_status_t;

/** ABI generation. The JS loader refuses a module that disagrees with it. */
uint32_t chores_abi_version(void);

/** True when this build was compiled with wasm128 / SSE2 vector kernels. */
uint32_t chores_has_simd(void);

/**
 * BT.709 luma histogram over sRGB-encoded 8-bit channels.
 *
 * Weights 0.2126 / 0.7152 / 0.0722 are applied without a linearize step, and
 * the bin index is round-half-up of the weighted sum, exactly as `cpuJobs.ts`
 * does it — the two must agree bin-for-bin on every golden.
 *
 * @param rgba        pixel_count * 4 bytes, tightly packed.
 * @param pixel_count width * height.
 * @param bins        256 u32 counters; zeroed by this call before accumulating.
 */
chores_status_t chores_luma_histogram_bt709(const uint8_t* rgba, uint32_t pixel_count,
                                            uint32_t* bins);

/**
 * Area-average (box filter) downsample between two packed RGBA8 buffers.
 * Alpha is averaged with the colour channels, matching `downsample2dCpu`.
 * Rounding is half-to-even on the exact rational average, which is what
 * storing into a `Uint8ClampedArray` does in JS.
 */
chores_status_t chores_downsample_2d(const uint8_t* src, uint32_t src_width, uint32_t src_height,
                                      uint8_t* dst, uint32_t dst_width, uint32_t dst_height);

/**
 * Apply a 256-entry u8 map to R, G and B. Alpha passes through untouched.
 * `src` and `dst` may alias only if they are the same pointer.
 */
chores_status_t chores_lut_u8_map(const uint8_t* src, uint32_t pixel_count, const uint8_t* lut,
                                   uint8_t* dst);

#ifdef __cplusplus
}  // extern "C"
#endif

#endif  // CHORES_API_H
