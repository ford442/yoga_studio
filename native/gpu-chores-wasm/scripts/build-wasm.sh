#!/usr/bin/env bash
#
# Build app/lib/gpuChores/wasm/chores.wasm and its base64 module.
#
# Toolchain is plain clang targeting wasm32 (freestanding, `-nostdlib`), not
# Emscripten: these kernels use no libc, no STL and no JS runtime, so emsdk
# would add a ~1GB toolchain download and a few KB of glue to buy nothing. The
# ESM loader is hand-written in app/lib/gpuChores/wasm/choresModule.ts instead.
#
# Requirements: clang 16+ and wasm-ld (Debian/Ubuntu: `clang lld`).
# Regenerate with `npm run build:chores-wasm` after touching native/.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo="$(cd "$here/../.." && pwd)"
out_dir="$repo/app/lib/gpuChores/wasm"
wasm="$out_dir/chores.wasm"

CLANG="${CLANG:-clang++}"
command -v "$CLANG" >/dev/null || { echo "build-chores-wasm: $CLANG not found" >&2; exit 1; }

mkdir -p "$out_dir"

# --export-dynamic is not used on purpose: every symbol the loader may call is
# listed here, so an accidental export cannot become part of the ABI.
exports=(
  chores_abi_version
  chores_has_simd
  chores_arena_alloc
  chores_arena_reset
  chores_arena_used
  chores_luma_histogram_bt709
  chores_downsample_2d
  chores_lut_u8_map
)
export_flags=()
for symbol in "${exports[@]}"; do export_flags+=("-Wl,--export=$symbol"); done

"$CLANG" \
  --target=wasm32 \
  -std=c++20 \
  -O3 -flto \
  -msimd128 \
  -nostdlib -ffreestanding \
  -fno-exceptions -fno-rtti \
  -fvisibility=hidden \
  -Wall -Wextra -Wpedantic -Werror \
  -I "$here/src" \
  -Wl,--no-entry \
  -Wl,--strip-all \
  -Wl,--export-memory \
  -Wl,--initial-memory=1048576 \
  -Wl,--max-memory=268435456 \
  "${export_flags[@]}" \
  -o "$wasm" \
  "$here/src/histogram.cpp" "$here/src/downsample.cpp" "$here/src/lut.cpp" "$here/src/runtime.cpp"

node "$here/scripts/emit-binary-module.mjs" "$wasm" "$out_dir/choresWasmBinary.ts"

echo "build-chores-wasm: wrote $(wc -c <"$wasm") bytes to ${wasm#"$repo"/}"
