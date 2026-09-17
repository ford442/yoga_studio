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
testhost/          host tests against a port of cpuJobs.ts
```

## Build and test

```sh
npm run test:native        # configure, build, run the host C++ gate
npm run build:chores-wasm  # regenerate app/lib/gpuChores/wasm/chores.wasm
```

The host gate needs only a C++20 compiler; the wasm build needs `clang` 16+ and
`wasm-ld` (`apt install clang lld`). Regenerate the wasm and commit it whenever
anything under `src/` changes — a vitest case fails if the committed `.wasm` and
its base64 module disagree.

## clangd / compile_commands.json

```sh
cmake -S native/gpu-chores-wasm -B native/gpu-chores-wasm/build \
      -DCMAKE_EXPORT_COMPILE_COMMANDS=ON
ln -sf native/gpu-chores-wasm/build/compile_commands.json compile_commands.json
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
