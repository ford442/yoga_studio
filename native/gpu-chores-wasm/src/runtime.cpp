#include "api.h"

#include "simd.h"

/*
 * ABI probes plus, on wasm, the two-call arena the JS loader uses to hand
 * buffers across. There is no general-purpose allocator here on purpose: the
 * kit's jobs are "reserve, fill, run, reset", and a bump arena keeps the module
 * free of malloc, free lists, and a libc.
 */

#define CHORES_ABI_VERSION_VALUE 1u

extern "C" uint32_t chores_abi_version(void) { return CHORES_ABI_VERSION_VALUE; }

extern "C" uint32_t chores_has_simd(void) { return CHORES_SIMD; }

#if defined(__wasm__)

extern "C" {
// Provided by wasm-ld: the first byte past the module's static data.
extern uint8_t __heap_base;
}

namespace {

constexpr uint32_t kWasmPageBytes = 65536u;
uint32_t g_arena_top = 0u;

inline uint32_t HeapBase() { return static_cast<uint32_t>(reinterpret_cast<uintptr_t>(&__heap_base)); }

}  // namespace

/** Drop every previous reservation. The loader calls this before each job. */
extern "C" void chores_arena_reset(void) { g_arena_top = 0u; }

/** Bytes currently reserved; exported so the JS tests can assert arena reuse. */
extern "C" uint32_t chores_arena_used(void) {
  return g_arena_top == 0u ? 0u : g_arena_top - HeapBase();
}

/**
 * Reserve `size` bytes, 16-byte aligned for the vector loads, growing linear
 * memory when needed. Returns 0 when the growth is refused.
 */
extern "C" uint32_t chores_arena_alloc(uint32_t size) {
  if (size == 0u) return 0u;
  if (g_arena_top == 0u) g_arena_top = HeapBase();

  const uint32_t aligned = (g_arena_top + 15u) & ~15u;
  if (aligned < g_arena_top) return 0u;  // wrapped
  const uint32_t end = aligned + size;
  if (end < aligned) return 0u;  // wrapped

  const uint32_t have = static_cast<uint32_t>(__builtin_wasm_memory_size(0)) * kWasmPageBytes;
  if (end > have) {
    const uint32_t pages = (end - have + kWasmPageBytes - 1u) / kWasmPageBytes;
    if (__builtin_wasm_memory_grow(0, pages) == static_cast<__SIZE_TYPE__>(-1)) return 0u;
  }

  g_arena_top = end;
  return aligned;
}

#endif  // __wasm__
