# Shader Asset Inventory

This document is the single source of truth for WGSL/GLSL assets in the Sacred Breath Timer repo. It lists what is shipped to browsers, what is preserved for reference, and what is experimental.

## Asset ownership layout

```
public/                          # Copied to out/ during static export — runtime only
├── sacred-monk.wgsl             # Active shader
├── sacred-lotus-final.wgsl      # Active shader
├── sacred-ultra.wgsl            # Active shader
├── yoga-regular.wgsl            # Active shader
├── manifest.webmanifest         # PWA manifest
├── backgrounds/                 # Runtime background images
└── instructor/                  # Runtime instructor clips

archive/shaders/                 # Not exported; historical preservation
├── legacy/                      # Superseded reference shaders
├── experiments/                 # Multi-pass / modular / swarm experiments
└── generated/                   # Agent outputs and summary docs

agents/swarm-outputs/            # Swarm task outputs (already non-public)
swarm-outputs/                   # Merged swarm outputs (already non-public)
```

## Active runtime shaders

These files live in `public/` and are fetched at runtime by `WebGPUShader.tsx` via `resolveAssetUrl(shaderPath)`. Every active shader must declare the **same** `struct Uniforms` layout defined in `app/lib/shaderContract.ts` and use `@group(0) @binding(0) var<uniform> u: Uniforms;`.

| File | Entry points | Used by technique | Visual role |
|------|--------------|-------------------|-------------|
| `public/sacred-monk.wgsl` | `vs` / `main` | Box Breathing (`classic-mandala`), Grounding (`grounding`) | Mandala + sacred monk silhouette + neon glow |
| `public/sacred-lotus-final.wgsl` | `vs` / `main` | Nadi Shodhana, Ujjayi, Lotus Heart, Prana Flow, Deep Release | Lotus bloom + prana ribbons + ethereal figure |
| `public/sacred-ultra.wgsl` | `vs` / `main` | Sacred Integration (`sacred-ultra`) | Cinematic composition: ribbons, figure, chakras, lotus, post-processing |
| `public/yoga-regular.wgsl` | `vs_main` / `fs_main` | Coherent Breath (`nervous-system-reg`) | Simpler geometry and figure for clinical-calm pacing |

Validate any contract changes with:

```bash
npm run validate:shaders
```

## Legacy reference shaders (`archive/shaders/legacy/`)

These were earlier iterations or direct GLSL-to-WGSL ports. They are kept for historical context but are **not loaded** by the app.

| File | Note |
|------|------|
| `yoga-breath.wgsl` | Early base SDF scene shader; superseded by `sacred-monk.wgsl`. |
| `yoga-visuals.wgsl` | Visual-effects exploration that predates the current single-pass renderer. |
| `yoga-fixed.wgsl` | Fixed variant of `yoga-regular.wgsl`; kept as a reference diff. |
| `yoga.glsl` | Original GLSL reference before the WGSL port. |

## Experimental / modular shaders (`archive/shaders/experiments/`)

These are compute passes, swarm experiments, and composable modules that were never wired into the active single-pass renderer.

| File | Note |
|------|------|
| `aurora-compute.wgsl` | Aurora background compute pass (legacy multi-pass pipeline). |
| `bloom-compute.wgsl` | Bright extract + Gaussian blur compute pass (legacy multi-pass pipeline). |
| `composite.wgsl` | Final blend pass for the legacy multi-pass pipeline. |
| `particle-compute.wgsl` | Particle simulation compute pass (legacy). |
| `particle-render.wgsl` | Particle instanced-quad render pass (legacy). |
| `breath-swarm-merged.wgsl` | Swarm experiment: merged breath-shader output. |
| `breath-swarm-next.wgsl` | Swarm experiment: follow-up iteration. |
| `energy-ribbons.wgsl` | Modular ribbon effect intended to be composited into an active shader. |
| `lotus-ethereal.wgsl` | Modular lotus effect intended to be composited into an active shader. |
| `yoga-light.wgsl` | Lightweight variant of `yoga-regular.wgsl`. |
| `yoga-strong.wgsl` | Higher-intensity variant of `yoga-regular.wgsl`. |
| `yoga-regular.glsl` | GLSL companion to the WGSL `yoga-regular` family. |
| `yoga-regular.wgsl` | Duplicate/variant of the active `public/yoga-regular.wgsl` preserved here for diffing. |

## Generated artifacts (`archive/shaders/generated/`)

| File | Note |
|------|------|
| `Kimi_Agent_Sacred Breath Shader.zip` | Packaged agent output containing shader iterations. Not deployed. |
| `YOGA_SHADER_REFACTOR_SUMMARY.md` | Human-readable refactor summary from the agent zip. |

## External swarm outputs (already non-public)

| Location | Note |
|----------|------|
| `agents/swarm-outputs/` | Per-task WGSL outputs and merge summary from earlier shader swarms. |
| `swarm-outputs/` | Consolidated ultra shaders (`ultra-background.wgsl`, `ultra-figure.wgsl`, `ultra-lotus.wgsl`). |

## Adding a new active shader

1. Place the `.wgsl` file in `public/`.
2. Declare the identical `struct Uniforms` from `app/lib/shaderContract.ts` at the top of the file.
3. Use `@group(0) @binding(0) var<uniform> u: Uniforms;`.
4. Add the file path to `ACTIVE_SHADERS` in `scripts/validate-shaders.ts`.
5. Add the file path to the smoke tests in `scripts/smoke-assets.mjs` and `e2e/smoke.spec.ts`.
6. Reference it from a technique in `app/data/techniques.ts` via `shaderPath`.
7. Update this inventory.

Do **not** add a second `struct Uniforms` definition; the shader itself is the only place that struct should be declared.
