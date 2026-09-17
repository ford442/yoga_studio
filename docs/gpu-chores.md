# gpu-chores (Tier B)

Small, content-agnostic GPU helpers for UI and media work — a luma histogram,
a 2D downsample for thumbs, and an optional u8 LUT map. They exist so
performance settings and shader diagnostics can analyse imagery without every FX
module owning a device, and so a WebGPU failure in Chrome or Edge does not look
like "the studio renderer died".

Studio-specific WGSL (`public/sacred-*.wgsl`) stays local and app-owned. Nothing
in the chores kit knows about breath, mandalas, or the practice screen.

## Layout

| Path | Role |
|------|------|
| `app/lib/gpuChores/types.ts` | Job, source and result types |
| `app/lib/gpuChores/policy.ts` | Backend selection + break-even |
| `app/lib/gpuChores/cpuJobs.ts` | Canvas2D / JS tiers, BT.709 luma |
| `app/lib/gpuChores/wasmJobs.ts` | WASM tier: marshalling around the C ABI |
| `app/lib/gpuChores/wasm/choresModule.ts` | Loads the kernels once, never throws |
| `app/lib/gpuChores/wasm/chores.wasm` | Committed build artifact (~6 KB) |
| `native/gpu-chores-wasm/` | The C++ kernels and their host tests |
| `app/lib/gpuChores/runner.ts` | Runs a job, falls back, drops a breadcrumb |
| `app/lib/gpuChores/breadcrumbs.ts` | Ring buffer + `window.gpuChores` |
| `app/lib/gpuChores/levels.ts` | Histogram → scrim strength |
| `app/lib/gpuChores/flags.ts` | `?no_gpu_compute` kill switch |
| `app/renderer/gpuChores/choreDevice.ts` | The single device loan point |
| `app/renderer/gpuChores/webgpuJobs.ts` | Compute shaders + WebGPU executor |

`app/lib` never imports the renderer: the WebGPU executor is injected at the call
site (`useEnvironmentLevels`), which keeps the kit unit-testable in jsdom.

## Device ownership

Chores never call `requestAdapter`. `WebGPUBackend` lends its device through
`lendChoreDevice()` after a successful boot and revokes it (`null`) on device
loss, fatal error, and stop; recovery lends the new device when it lands. So
adapter selection and the one-shot recovery path stay singleton and app-owned,
and there is never a second live device — nor a WebGL context kept hot beside
WebGPU. WebGL2 stays a renderer fallback only.

## Backend order

**WebGPU → WASM SIMD → Canvas2D (downsample only) → JS.**

A job takes the WebGPU tier only when all of these hold:

1. the kill switch is off,
2. the renderer is lending a device,
3. the source clears `GPU_BREAK_EVEN_PIXELS` (512×512) — below that, dispatch and
   readback cost more than running the kernel in-process.

Everything below that line goes to the WASM tier when the kernels loaded. WASM
outranks Canvas2D even for downsample, which is the one job Canvas2D can do
natively: `drawImage` applies the *browser's* filter rather than the area average
the kit specifies, so it matches the goldens only approximately, and it needs a
canvas round trip on both sides. The native kernel is bit-exact with `cpuJobs.ts`
and takes packed bytes directly. Canvas2D therefore only ever runs downsample,
and only when there is no WASM tier.

If the WebGPU attempt throws, the runner logs it and finishes the job on the tier
below; `fellBack` and the breadcrumb's `gpuError` record what happened.

## The WASM tier

`native/gpu-chores-wasm` holds three C++ kernels compiled to wasm32 with
`-msimd128`. They are the same three jobs, held to the same goldens: the host
C++ test suite checks them against a line-for-line port of `cpuJobs.ts`, and the
vitest suite checks the *shipped* `.wasm` against `cpuJobs.ts` itself.

The module is committed (`app/lib/gpuChores/wasm/chores.wasm`, ~6 KB) alongside a
generated base64 module, so `npm run build` works on a machine with no C++
toolchain and the static export needs no extra fetch. Regenerate both with
`npm run build:chores-wasm` after touching `native/`; a unit test fails if they
drift apart.

**Failure is expected and handled.** The module is compiled with SIMD, so an
engine without wasm SIMD rejects it at compile time — and that rejection *is* the
capability check. A CSP without `wasm-unsafe-eval` fails the same way. Either
way `loadChoresWasm()` resolves with `module: null` and a reason rather than
throwing, the job falls through to Canvas2D/JS, and the breadcrumb carries the
reason (`… · wasm unavailable (CompileError: …)`). The studio renderer never sees
any of it.

Everything above `wasmJobs.ts` works in `Uint8Array`s. Pointers, the bump arena
and the C ABI stop at that file, and no view into linear memory is ever returned
to a caller — a later job reuses those bytes.

### Toolchain

The kernels are built with `clang --target=wasm32 -nostdlib` rather than
Emscripten: they need no libc, STL or JS runtime, so emsdk would add a ~1 GB CI
download to produce the same module plus glue. `native/gpu-chores-wasm/README.md`
has the full reasoning and the point at which switching to emsdk would be right.

`compile_commands.json` for clangd comes from CMake and is **never committed** —
it records one machine's absolute paths:

```sh
cmake -S native/gpu-chores-wasm -B native/gpu-chores-wasm/build \
      -DCMAKE_EXPORT_COMPILE_COMMANDS=ON
ln -sf native/gpu-chores-wasm/build/compile_commands.json compile_commands.json
```

## Jobs

- `luma_histogram_bt709` — 256-bin readback. Weights (0.2126 / 0.7152 / 0.0722)
  are applied to the sRGB-encoded 8-bit channels, matching the Chromashift
  goldens. Both tiers derive `meanLuma` from the bins so they agree exactly.
- `downsample_2d` — area-average box filter to a small bitmap (thumbs only).
- `lut_u8_map` — 256-entry map over R/G/B; alpha passes through. **No production
  caller yet.** It exists on all four tiers so the GPU media compositor can grade
  thumbs without a scalar JS loop on the breath rAF when WebGPU compute is off;
  until the compositor lands it is covered by unit tests and the host C++ goldens
  only. Do not delete it — see the compositor issue referenced from `runner.ts`.

Compute shaders dispatch at `(8, 8)`.

## Where it is used

`useEnvironmentLevels` measures the active background plate: the full plate is
downsampled to a 128×72 thumb (GPU, past break-even), and that thumb's histogram
runs below break-even — so on the WASM tier where it loads, and on JS where it
does not. The result sets the vignette strength in
`EnvironmentBackground`, replacing the plate's baked `averageLuminance` — which
remains the fallback whenever the measurement is unavailable.

## Diagnostics and the kill switch

The renderer diagnostics panel shows `Chores: <backend> · <reason>` — on a
mid-size plate with `?no_gpu_compute` that reads `Chores: wasm · GPU compute
disabled (kill switch)`. `window.gpuChores` carries the last 20 breadcrumbs, each
with the backend, the reason, and — when a tier was skipped — why. Turn the GPU
tier off with `?no_gpu_compute` or the "GPU compute helpers" toggle in
Settings → Renderer.
