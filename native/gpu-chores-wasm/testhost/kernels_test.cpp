#include "microtest.h"
#include "reference.h"

#include "api.h"

#include <cstdint>
#include <vector>

namespace {

/**
 * A deterministic xorshift so a failure is reproducible from the seed alone —
 * these tests run in CI, where "it passed on my machine" is not a defence.
 */
struct Rng {
  uint32_t state;
  explicit Rng(uint32_t seed) : state(seed ? seed : 0x9E3779B9u) {}
  uint32_t next() {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return state;
  }
  uint8_t byte() { return static_cast<uint8_t>(next() & 0xFFu); }
};

std::vector<uint8_t> RandomImage(uint32_t width, uint32_t height, uint32_t seed) {
  Rng rng(seed);
  std::vector<uint8_t> pixels(static_cast<size_t>(width) * height * 4u);
  for (uint8_t& byte : pixels) byte = rng.byte();
  return pixels;
}

bool BytesEqual(const std::vector<uint8_t>& a, const std::vector<uint8_t>& b) {
  if (a.size() != b.size()) return false;
  for (size_t i = 0; i < a.size(); ++i) {
    if (a[i] != b[i]) {
      std::fprintf(stderr, "    first byte mismatch at %zu: got %u, want %u\n", i,
                   static_cast<unsigned>(a[i]), static_cast<unsigned>(b[i]));
      return false;
    }
  }
  return true;
}

}  // namespace

TEST_CASE("abi version and simd probe are sane") {
  CHECK_EQ(chores_abi_version(), 1u);
  // The host gate is built with SSE2 on x86-64 and scalar elsewhere; either is
  // a valid answer, the probe just has to be a boolean.
  CHECK(chores_has_simd() <= 1u);
}

TEST_CASE("histogram matches the BT.709 golden bin for bin") {
  for (const uint32_t seed : {1u, 7u, 4242u}) {
    const uint32_t width = 61, height = 37;  // deliberately not a vector multiple
    const std::vector<uint8_t> image = RandomImage(width, height, seed);
    const uint32_t pixels = width * height;

    std::vector<uint32_t> bins(256, 0xDEADBEEFu);
    REQUIRE(chores_luma_histogram_bt709(image.data(), pixels, bins.data()) == CHORES_OK);

    const std::vector<uint32_t> want = reference::LumaHistogram(image, pixels);
    uint32_t total = 0;
    for (uint32_t bin = 0; bin < 256u; ++bin) {
      CHECK_EQ(bins[bin], want[bin]);
      total += bins[bin];
    }
    CHECK_EQ(total, pixels);
  }
}

TEST_CASE("histogram covers both bin extremes") {
  // Pure black and pure white must land in bin 0 and bin 255, not one short.
  const std::vector<uint8_t> image = {0, 0, 0, 255, 255, 255, 255, 255};
  std::vector<uint32_t> bins(256, 0u);
  REQUIRE(chores_luma_histogram_bt709(image.data(), 2u, bins.data()) == CHORES_OK);
  CHECK_EQ(bins[0], 1u);
  CHECK_EQ(bins[255], 1u);
}

TEST_CASE("histogram rejects bad input without trapping") {
  std::vector<uint32_t> bins(256, 9u);
  const uint8_t pixel[4] = {1, 2, 3, 4};
  CHECK(chores_luma_histogram_bt709(nullptr, 1u, bins.data()) == CHORES_ERR_NULL);
  CHECK(chores_luma_histogram_bt709(pixel, 1u, nullptr) == CHORES_ERR_NULL);
  CHECK(chores_luma_histogram_bt709(pixel, 0u, bins.data()) == CHORES_ERR_EMPTY);
  // An empty image still leaves the caller with zeroed bins, not stale ones.
  CHECK_EQ(bins[0], 0u);
}

TEST_CASE("downsample matches the area-average golden byte for byte") {
  struct Size {
    uint32_t sw, sh, dw, dh;
  };
  const Size sizes[] = {
      {64, 64, 16, 16},    // exact integer ratio
      {193, 121, 128, 72}, // the levels thumb, from an odd plate
      {17, 5, 5, 3},       // ragged boxes
      {8, 8, 8, 8},        // identity
      {4, 4, 9, 9},        // upscale: every box collapses to one pixel
  };
  for (const Size& size : sizes) {
    const std::vector<uint8_t> src = RandomImage(size.sw, size.sh, size.sw * 131u + size.dh);
    std::vector<uint8_t> got(static_cast<size_t>(size.dw) * size.dh * 4u, 0u);
    REQUIRE(chores_downsample_2d(src.data(), size.sw, size.sh, got.data(), size.dw, size.dh) ==
            CHORES_OK);
    const std::vector<uint8_t> want =
        reference::Downsample2d(src, size.sw, size.sh, size.dw, size.dh);
    CHECK(BytesEqual(got, want));
  }
}

TEST_CASE("downsample of a flat plate is that exact colour") {
  const uint32_t sw = 40, sh = 24;
  std::vector<uint8_t> src(static_cast<size_t>(sw) * sh * 4u);
  for (size_t i = 0; i < src.size(); i += 4u) {
    src[i] = 12; src[i + 1] = 200; src[i + 2] = 77; src[i + 3] = 255;
  }
  std::vector<uint8_t> got(10u * 6u * 4u, 0u);
  REQUIRE(chores_downsample_2d(src.data(), sw, sh, got.data(), 10u, 6u) == CHORES_OK);
  for (size_t i = 0; i < got.size(); i += 4u) {
    CHECK_EQ(got[i], 12); CHECK_EQ(got[i + 1], 200);
    CHECK_EQ(got[i + 2], 77); CHECK_EQ(got[i + 3], 255);
  }
}

TEST_CASE("downsample rounds halves to even, like Uint8ClampedArray") {
  // A 2x1 box averaging 10 and 11 is 10.5 → 10; 11 and 12 is 11.5 → 12.
  const std::vector<uint8_t> src = {10, 11, 250, 0, 11, 12, 251, 1};
  std::vector<uint8_t> got(4u, 0u);
  REQUIRE(chores_downsample_2d(src.data(), 2u, 1u, got.data(), 1u, 1u) == CHORES_OK);
  CHECK_EQ(got[0], 10);   // (10 + 11) / 2
  CHECK_EQ(got[1], 12);   // (11 + 12) / 2
  CHECK_EQ(got[2], 250);  // (250 + 251) / 2 → 250.5
  CHECK_EQ(got[3], 0);    // (0 + 1) / 2 → 0.5
}

TEST_CASE("downsample rejects bad input without trapping") {
  const uint8_t src[4] = {1, 2, 3, 4};
  uint8_t dst[4] = {0, 0, 0, 0};
  CHECK(chores_downsample_2d(nullptr, 1, 1, dst, 1, 1) == CHORES_ERR_NULL);
  CHECK(chores_downsample_2d(src, 1, 1, nullptr, 1, 1) == CHORES_ERR_NULL);
  CHECK(chores_downsample_2d(src, 0, 1, dst, 1, 1) == CHORES_ERR_EMPTY);
  CHECK(chores_downsample_2d(src, 1, 1, dst, 1, 0) == CHORES_ERR_EMPTY);
  CHECK(chores_downsample_2d(src, 1u << 20, 1, dst, 1, 1) == CHORES_ERR_OVERFLOW);
}

TEST_CASE("lut map matches the golden and passes alpha through") {
  uint8_t lut[256];
  for (int i = 0; i < 256; ++i) lut[i] = static_cast<uint8_t>(255 - i);

  const std::vector<uint8_t> src = RandomImage(31, 17, 99u);
  std::vector<uint8_t> got(src.size(), 0u);
  REQUIRE(chores_lut_u8_map(src.data(), 31u * 17u, lut, got.data()) == CHORES_OK);
  CHECK(BytesEqual(got, reference::LutU8Map(src, lut)));

  for (size_t i = 3; i < got.size(); i += 4u) CHECK_EQ(got[i], src[i]);
}

TEST_CASE("lut map works in place") {
  uint8_t lut[256];
  for (int i = 0; i < 256; ++i) lut[i] = static_cast<uint8_t>(i / 2);
  std::vector<uint8_t> pixels = RandomImage(9, 9, 5u);
  const std::vector<uint8_t> want = reference::LutU8Map(pixels, lut);
  REQUIRE(chores_lut_u8_map(pixels.data(), 81u, lut, pixels.data()) == CHORES_OK);
  CHECK(BytesEqual(pixels, want));
}

TEST_CASE("lut map rejects bad input without trapping") {
  const uint8_t src[4] = {1, 2, 3, 4};
  uint8_t dst[4] = {0, 0, 0, 0};
  uint8_t lut[256] = {0};
  CHECK(chores_lut_u8_map(nullptr, 1u, lut, dst) == CHORES_ERR_NULL);
  CHECK(chores_lut_u8_map(src, 1u, nullptr, dst) == CHORES_ERR_NULL);
  CHECK(chores_lut_u8_map(src, 1u, lut, nullptr) == CHORES_ERR_NULL);
  CHECK(chores_lut_u8_map(src, 0u, lut, dst) == CHORES_ERR_EMPTY);
}

int main() { return microtest::RunAll(); }
