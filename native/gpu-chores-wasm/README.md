# gpu-chores native kernels

The numeric mid-tier of the gpu-chores kit: a BT.709 luma histogram, an
area-average downsample and a 256-entry LUT map, compiled to wasm32 and to a
host binary for tests.

TypeScript stays the app language. This tree is *only* the pixel loops that sit
between WebGPU and the JS reference — see `docs/gpu-chores.md` for where it fits
in the backend order and `app/lib/gpuChores/wasmJobs.ts` for the only code that
is allowed to know these functions take pointers.

```
src/api.h          C ABI: pointer + length, no STL, no exceptions
src/histogram.cpp  BT.709 luma, 256 bins
src/downsample.cpp area-average box filter (wasm128 / SSE2)
src/lut.cpp        256-entry RGB map, alpha passthrough
src/runtime.cpp    ABI probes + the wasm bump arena
testhost/          host tests + fuzz corpus against a port of cpuJobs.ts
cmake/, CMakePresets.json   shared flags; presets host / host-asan / host-tidy / wasm
```

## Build and test

```sh
npm run test:native        # host build + tests (CMake preset `host`)
npm run test:native:asan   # same under AddressSanitizer + UBSan (`host-asan`)
npm run test:native:tidy   # same with clang-tidy as errors (`host-tidy`)
npm run build:chores-wasm  # regenerate app/lib/gpuChores/wasm/chores.wasm (`wasm`)
```

All four share their flags through `CMakePresets.json` and `cmake/`:
`-Wall -Wextra -Wpedantic -Wconversion -Wshadow -Wdouble-promotion -Werror` on
the kernels, `-fno-exceptions -fno-rtti`, so a warning the wasm build would
reject fails the fast host gate too. The host gate needs a C++20 compiler and
CMake 3.25+; the asan/tidy/wasm presets need `clang`, `clang-tidy` and `lld`
(`apt install clang lld clang-tidy cmake`).

**`build:chores-wasm` is safe to fail.** It preflights the toolchain (including
a real wasm32 link of an empty module, because `wasm-ld` is shipped under
different names), builds into a temp directory, and only then replaces the
committed files. A missing linker or a compile error leaves `chores.wasm` and
`choresWasmBinary.ts` untouched.

**Committed artifact = reproducible artifact.** Regenerate and commit whenever
anything under `native/` changes. CI (`native-kernels` job) rebuilds on
`ubuntu-24.04` with clang 18 and fails on any difference, so use clang 18 when
you regenerate (Ubuntu 24.04's `clang-18` 18.1.3 produces the committed bytes;
`-flto --strip-all` output is not guaranteed stable across clang majors). If a
toolchain bump ever changes the bytes without changing behaviour, bump the pin
in `.github/workflows/ci.yml` and this paragraph in the same commit as the
regenerated module.

## Test layers

- `testhost/kernels_test.cpp` — hand-written cases plus a **seeded differential
  fuzz**: 400 cases (odd/prime sizes, 1-pixel images, up/down/identity scaling,
  tie-heavy and saturated content, misaligned input pointers, in-place LUT,
  sentinel-fenced outputs) compared with `testhost/reference.h`. Buffers are
  exact-size heap allocations so ASan red zones sit right after the last byte.
- `testhost/corpus.h` ↔ `app/lib/gpuChores/__tests__/corpus.ts` — the corpus
  generator exists in both languages and both assert the same digest, so
  `app/lib/gpuChores/__tests__/wasmFuzz.test.ts` runs the *identical* inputs
  through the shipped `.wasm` and compares with the JS tier.
- `.clang-tidy` — `bugprone-*`, `performance-*`, `cppcoreguidelines-pro-bounds-*`.
  The raw-pointer ABI is the point of this tree, so the audited kernel loops carry
  `NOLINTBEGIN/END` blocks that state the bounds argument; anything new outside
  them is an error.

## clangd / compile_commands.json

```sh
cd native/gpu-chores-wasm && cmake --preset host
cd ../.. && ln -sf native/gpu-chores-wasm/build/host/compile_commands.json compile_commands.json
```

Both the build tree and the symlink are gitignored. Do not commit a copy: it
records absolute paths and the exact flags of one machine, so a committed one is
wrong for everyone else within a day.

## Why clang, not Emscripten

The issue that asked for this tree specified Emscripten, and these kernels
turned out not to need it. They use no libc, no STL, no filesystem and no JS
runtime — the whole ABI is pointers and lengths over a bump arena — so
`clang --target=wasm32 -nostdlib` produces the same module that
`em++ -sMODULARIZE=1 -sEXPORT_ES6=1` would, minus Emscripten's glue, and the ESM
loader is 120 readable lines in `app/lib/gpuChores/wasm/choresModule.ts` instead
of generated output.

What that buys:

- **CI stays cheap.** The native gate is `apt install clang lld`, not a ~1 GB
  emsdk download or a Docker image, so it can run on every push.
- **Nothing to configure at runtime.** The module imports nothing at all, so
  there is no `Module{}` object, no memory-growth callback, and no generated
  file to keep in sync with the hand-written loader.
- **`ALLOW_MEMORY_GROWTH` is `memory.grow`.** `src/runtime.cpp` calls it
  directly, which is what the Emscripten flag compiles down to anyway.

If a future job needs the STL, `malloc`, threads or a filesystem shim, that is
the point to switch to emsdk — the C ABI in `api.h` is deliberately the kind
Emscripten exports unchanged, so the loader would not have to move.

## Rules

- No OpenCV, Eigen, or any general image library. Three kernels, hand-written.
- No shaders rewritten in C++. WGSL stays in `app/renderer/gpuChores/`.
- No `requestAdapter`, no GPU, no DOM: this module cannot see either.
- Every kernel must stay bit-exact with `app/lib/gpuChores/cpuJobs.ts`. The JS
  tier is the correctness reference; `testhost/reference.h` is a line-for-line
  port of it, and that is what the tests compare against.
