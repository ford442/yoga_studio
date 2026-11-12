#!/usr/bin/env bash
#
# Build app/lib/gpuChores/wasm/chores.wasm and its base64 module.
#
# Toolchain is plain clang targeting wasm32 (freestanding, `-nostdlib`), not
# Emscripten: these kernels use no libc, no STL and no JS runtime, so emsdk
# would add a ~1GB toolchain download and a few KB of glue to buy nothing. The
# ESM loader is hand-written in app/lib/gpuChores/wasm/choresModule.ts instead.
# Every compile/link flag lives in CMakeLists.txt + cmake/ (the `wasm` preset),
# shared with the host gate; this script only drives it.
#
# Safety: everything is built under a temp dir and moved into the repo only
# after the whole pipeline succeeded, so a missing linker or a compile error can
# never delete or truncate the committed artifact.
#
# Requirements: clang 16+, wasm-ld (Debian/Ubuntu: `apt install clang lld`),
# cmake 3.25+, node. CI pins clang 18 — see README.md for the reproducibility note.
# Regenerate with `npm run build:chores-wasm` after touching native/.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo="$(cd "$here/../.." && pwd)"
out_dir="$repo/app/lib/gpuChores/wasm"

CLANG="${CLANG:-clang++}"
export CLANG

die() { echo "build-chores-wasm: $*" >&2; exit 1; }

# --- preflight: fail early, with an install hint, before touching anything -----
command -v "$CLANG" >/dev/null || die "$CLANG not found. Install clang 16+ (Debian/Ubuntu: sudo apt install clang lld; macOS: brew install llvm lld)."
command -v cmake >/dev/null   || die "cmake not found (need 3.25+). Debian/Ubuntu: sudo apt install cmake."
command -v node >/dev/null    || die "node not found."

clang_major="$("$CLANG" --version | sed -n 's/.*clang version \([0-9][0-9]*\)\..*/\1/p' | head -n1)"
[[ -n "$clang_major" && "$clang_major" -ge 16 ]] || die "need clang 16+, found: $("$CLANG" --version | head -n1)"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# `command -v wasm-ld` is not a reliable probe (distros ship it as wasm-ld-18
# and clang finds it next to itself), so ask the real linker driver: link an
# empty module for the wasm32 target and see whether it works.
echo 'extern "C" void probe() {}' > "$tmp/probe.cpp"
if ! "$CLANG" --target=wasm32 -nostdlib -ffreestanding -Wl,--no-entry -Wl,--export=probe \
    -o "$tmp/probe.wasm" "$tmp/probe.cpp" 2> "$tmp/probe.log"; then
  cat "$tmp/probe.log" >&2
  die "cannot link for wasm32 (wasm-ld missing?). Debian/Ubuntu: sudo apt install lld; macOS: brew install lld. The committed chores.wasm was NOT touched."
fi

# --- build into $tmp ---------------------------------------------------------
cmake --preset wasm -S "$here" -B "$tmp/build" >/dev/null || die "cmake configure failed; committed artifacts untouched."
cmake --build "$tmp/build" || die "wasm build failed; committed artifacts untouched."
[[ -s "$tmp/build/chores.wasm" ]] || die "build produced no chores.wasm; committed artifacts untouched."

node "$here/scripts/emit-binary-module.mjs" "$tmp/build/chores.wasm" "$tmp/choresWasmBinary.ts" \
  || die "emitting the base64 module failed; committed artifacts untouched."

# --- publish: both files exist and are complete, only now touch the repo ------
mkdir -p "$out_dir"
mv -f "$tmp/build/chores.wasm" "$out_dir/chores.wasm.new" && mv -f "$out_dir/chores.wasm.new" "$out_dir/chores.wasm"
mv -f "$tmp/choresWasmBinary.ts" "$out_dir/choresWasmBinary.ts.new" && mv -f "$out_dir/choresWasmBinary.ts.new" "$out_dir/choresWasmBinary.ts"

echo "build-chores-wasm: wrote $(wc -c <"$out_dir/chores.wasm") bytes to ${out_dir#"$repo"/}/chores.wasm (clang $clang_major)"
