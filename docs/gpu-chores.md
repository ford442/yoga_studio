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

WebGPU → Canvas2D (the WASM slot; no WASM helper is shipped) → JS. A job takes
the WebGPU tier only when all of these hold:

1. the kill switch is off,
2. the renderer is lending a device,
3. the source clears `GPU_BREAK_EVEN_PIXELS` (512×512) — small poster images stay
   on Canvas2D, where dispatch and readback would cost more than the scalar loop.

If the WebGPU attempt throws, the runner logs it and finishes the job on the CPU
tier; `fellBack` and the breadcrumb's `gpuError` record what happened.

## Jobs

- `luma_histogram_bt709` — 256-bin readback. Weights (0.2126 / 0.7152 / 0.0722)
  are applied to the sRGB-encoded 8-bit channels, matching the Chromashift
  goldens. Both tiers derive `meanLuma` from the bins so they agree exactly.
- `downsample_2d` — area-average box filter to a small bitmap (thumbs only).
- `lut_u8_map` — 256-entry map over R/G/B; alpha passes through.

Compute shaders dispatch at `(8, 8)`.

## Where it is used

`useEnvironmentLevels` measures the active background plate: the full plate is
downsampled to a 128×72 thumb (GPU, past break-even), and that thumb's histogram
runs on the CPU tier (below break-even). The result sets the vignette strength in
`EnvironmentBackground`, replacing the plate's baked `averageLuminance` — which
remains the fallback whenever the measurement is unavailable.

## Diagnostics and the kill switch

The renderer diagnostics panel shows `Chores: <backend> · <reason>`, and
`window.gpuChores` carries the last 20 breadcrumbs. Turn the GPU tier off with
`?no_gpu_compute` or the "GPU compute helpers" toggle in Settings → Renderer.
