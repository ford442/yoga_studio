<!-- From: /root/yoga_studio/AGENTS.md -->
# Yoga Studio - Sacred Breath Timer

An AI coding agent guide for this Next.js React application featuring a WebGPU-powered breathing visualization with posture guidance.

---

## Project Overview

**Yoga Studio** is a full-screen pranayama practice companion. It displays a large breath-phase countdown, an animated WebGPU visualization of a stick-figure yogi with chakra energy effects, and a simple SVG posture guide. The app is designed for single-session, immersive use on desktop and tablet.

The current runtime architecture is intentionally minimal: one breath timer hook drives one page, which renders one WebGPU canvas and one SVG posture overlay. Several older components and hooks remain in the repository but are **not imported by the active page**.

---

## Technology Stack

| Layer | Technology | Version / Notes |
|-------|------------|-----------------|
| Framework | Next.js | 16.1.6 (App Router) |
| UI Library | React | 19.2.3 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | v4 (`@import "tailwindcss"` in `globals.css`) |
| Build Output | Static Export | `output: 'export'` in `next.config.ts` |
| Graphics API | WebGPU / WGSL | `@webgpu/types` ^0.1.69 |
| Linting | ESLint | Flat config (`eslint.config.mjs`) with `eslint-config-next` |

---

## Build and Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev
# → http://localhost:3000

# Build static site for production
npm run build
# → Output goes to `out/` directory

# Start production server (for local verification)
npm start

# Run ESLint
npm run lint
```

---

## Project Structure

### Active Files (imported by `page.tsx` at runtime)

```
app/
├── layout.tsx                    # Root layout with metadata
├── page.tsx                      # Main page: countdown, controls, WebGPU, posture
├── globals.css                   # Tailwind v4 import + CSS variables
├── components/
│   ├── WebGPUShader.tsx          # Multi-pass WebGPU renderer (see below)
│   └── PostureGuide.tsx          # SVG stick-figure with rotating arms
└── hooks/
    └── useSacredBreathTimer.ts   # Breath timing + uniform generation
```

### Legacy / Unused Files (present but not imported by `page.tsx`)

| File | Status | Note |
|------|--------|------|
| `app/components/BreathTimer.tsx` | Unused | Rich timer UI with chakra cards; not imported by current page |
| `app/components/BreathingVisualizer.tsx` | Unused | Simpler WebGPU canvas with inline WGSL |
| `app/hooks/useBreathTimer.ts` | Unused | Defines detailed `CHAKRAS` and `PHASE_CHAKRAS` records; richer types but unused |
| `app/hooks/useBreathingTimer.ts` | Unused | Generic 4-phase timer hook |

> **Agent caution:** When modifying behavior, edit `useSacredBreathTimer.ts` and `WebGPUShader.tsx`, not the legacy files above, unless you are explicitly reviving them.

### Static Assets

```
public/
├── yoga-breath.wgsl              # Base scene shader (raymarched SDF + chakras)
├── shaders/
│   ├── bloom-compute.wgsl        # Bright extract + separable Gaussian blur
│   ├── particle-compute.wgsl     # 4096-particle spine energy simulation
│   ├── particle-render.wgsl      # Instanced quads for particles
│   ├── aurora-compute.wgsl       # Aurora background generation
│   └── composite.wgsl            # Final blend pass
├── yoga.glsl                     # Original GLSL reference (legacy)
├── yoga-regular.wgsl             # WGSL reference (legacy)
└── yoga-fixed.wgsl               # WGSL reference fix (legacy)
```

### Configuration Files

| File | Purpose |
|------|---------|
| `next.config.ts` | Static export, empty `basePath` |
| `tsconfig.json` | ES2017, strict, bundler resolution, `@/*` → `./*` |
| `postcss.config.mjs` | Tailwind v4 PostCSS plugin |
| `eslint.config.mjs` | Flat ESLint config with Next.js web-vitals + typescript presets |
| `webgpu.d.ts` | `/// <reference types="@webgpu/types" />` |
| `deploy.py` | SFTP deployment script (see Deployment) |

---

## WebGPU Shader Architecture

`WebGPUShader.tsx` is **not** a single-shader component. It builds a data-driven, 8-pass render pipeline using offscreen textures and compute passes.

### Render Pipeline Order

1. **Base render** — `public/yoga-breath.wgsl` → `sceneTexture` (full res)
2. **Bloom extract** — `public/shaders/bloom-compute.wgsl` (`bloom_extract` entry) → `bloomTemp1` (half res)
3. **Bloom blur H** — same WGSL (`bloom_blur` entry) → `bloomTemp2`
4. **Bloom blur V** — same WGSL (`bloom_blur` entry) → `bloomTemp1`
5. **Particle compute** — `public/shaders/particle-compute.wgsl` → updates particle buffer
6. **Particle render** — `public/shaders/particle-render.wgsl` → `particleTexture` (full res, instanced quads)
7. **Aurora compute** — `public/shaders/aurora-compute.wgsl` → `auroraTexture` (half res)
8. **Composite** — `public/shaders/composite.wgsl` → canvas (blends scene + bloom + aurora + particles)

### Shared Uniform Buffer

`WebGPUShader.tsx` injects the following WGSL struct into every shader at load time, stripping any duplicate `struct BreathUniforms` definitions it finds in the source files.

```wgsl
struct BreathUniforms {
    time:            f32,   // offset  0
    phase:           u32,   // offset  4  (0=inhale, 1=hold1, 2=exhale, 3=hold2)
    phaseProgress:   f32,   // offset  8
    cycle:           u32,   // offset 12
    strengthLevel:   u32,   // offset 16
    intensity:       f32,   // offset 20
    sin_time:        f32,   // offset 24
    cos_time:        f32,   // offset 28
    sin_fast:        f32,   // offset 32
    cos_fast:        f32,   // offset 36
    activeChakra:    f32,   // offset 40  (0–6)
    secondaryChakra: f32,   // offset 44  (-1 if none)
}
```

Total size: **48 bytes** (12 × `f32`).

The React side writes this buffer via `device.queue.writeBuffer()` inside the `updateUniforms` imperative handle, which `page.tsx` calls every `requestAnimationFrame`.

### Texture Resizing

On window resize, the component recreates all offscreen textures, rebuilds all bind groups, and rebuilds the pass descriptor array. The canvas dimensions are driven by `getBoundingClientRect()`.

---

## Breath Timing System

### Active Hook: `useSacredBreathTimer.ts`

This is the single source of truth for breath state. It is **not** auto-started on mount; the user presses the "Begin Sacred Breath" button in `page.tsx`.

#### Returned API

```typescript
{
  phase: 'inhale' | 'hold1' | 'exhale' | 'hold2',
  phaseProgress: number,        // 0–1 within current phase
  cycle: number,                // completed cycles
  countdown: number,            // ceiling seconds remaining in phase
  isRunning: boolean,
  strengthLevel: number,        // 0=Light, 1=Medium, 2=Strong
  start: () => void,
  pause: () => void,
  reset: () => void,
  setStrengthLevel: (n: number) => void,
  getUniforms: () => {          // data sent to WebGPU each frame
    time, phase, phaseProgress, cycle, strengthLevel, intensity,
    activeChakra, secondaryChakra
  }
}
```

#### Durations

Base durations per phase:
- `inhale`: 4s
- `hold1`: 4s
- `exhale`: 6s
- `hold2`: 2s

Strength scaling (applied inside `getDuration`):
- **Light (0):** base durations, then capped to 7s after cycle 16
- **Medium (1):** base durations, then capped to 8s after cycle 31
- **Strong (2):** base durations, capped to 8s after cycle 31, then 10s after cycle 61

#### Chakra Mapping in Uniforms

The shader receives `activeChakra` and `secondaryChakra` indices (0–6):

| Phase | `activeChakra` | `secondaryChakra` | Behavior |
|-------|---------------|-------------------|----------|
| Inhale | `min(5, floor(progress * 6))` | `min(6, active + 1)` | Rises from root toward third eye |
| Hold1 | 6 | -1 | Crown |
| Exhale | `max(1, 6 - floor(progress * 6))` | `active - 1` | Descends from crown toward sacral |
| Hold2 | 0 | -1 | Root |

The **shader** (`yoga-breath.wgsl`) independently implements its own chakra glow logic based on these uniforms, including energy-flow beams and hue shifts per phase.

---

## Code Style Guidelines

### TypeScript
- Target: ES2017
- Strict mode enabled
- Module resolution: `bundler`
- Path alias: `@/*` maps to `./*`

### React
- Functional components only
- Client components must start with `'use client'`
- Props interfaces defined inline
- Complex logic extracted to custom hooks

### Tailwind CSS v4
- Import via `@import "tailwindcss"` in `globals.css`
- Utility-first; glassmorphism via `backdrop-blur`, `bg-white/10`, etc.
- No `tailwind.config.js` is present; theming is done via `@theme inline` in `globals.css`

### WebGPU / WGSL
- Shaders in `public/` are loaded at runtime via `fetch()`
- `WebGPUShader.tsx` prepends a shared `BreathUniforms` struct; do **not** duplicate this struct in new shader files
- Entry points are consistently `vs_main` / `fs_main` for render pipelines, and descriptive names (`bloom_extract`, `update_particles`, etc.) for compute pipelines

---

## Testing Instructions

### Automated Tests
**There are no automated tests.** The project does not include Jest, Vitest, Playwright, Cypress, or any other test framework.

### Manual Testing Checklist

When making changes, verify the following in a WebGPU-compatible browser (Chrome/Edge 113+):

- [ ] `npm run dev` starts without TypeScript or ESLint errors
- [ ] Page loads and shows "Begin Sacred Breath" button
- [ ] Pressing "Begin" starts the countdown
- [ ] Phases cycle through: inhale → hold1 → exhale → hold2
- [ ] Cycle count increments after each full round
- [ ] Pause stops the timer; resume continues from where it left off
- [ ] Reset returns to cycle 0, phase inhale, countdown restored
- [ ] Strength selector (Light / Medium / Strong) changes phase durations
- [ ] WebGPU canvas renders (not black) — check for shader compilation errors in DevTools
- [ ] Posture guide SVG arms rotate appropriately per phase
- [ ] Responsive layout does not break on window resize
- [ ] `npm run build` completes and outputs to `out/`

---

## Deployment Process

### Build
```bash
npm run build
```

### SFTP Deploy
```bash
python deploy.py
```

- `deploy.py` uses `paramiko` to upload the `out/` directory recursively.
- It contains hardcoded server credentials (`HOSTNAME`, `USERNAME`, `PASSWORD`).
- If the `out/` directory is missing, the script prints an error reminding you to run `npm run build` first.

### Static Hosting
Because `next.config.ts` sets `output: 'export'`, the `out/` folder is a complete static site and can be served by any static host (Netlify, Vercel, GitHub Pages, S3, etc.).

---

## Security Considerations

- `deploy.py` contains a **hardcoded plaintext password**. Do not commit this file to public repositories without refactoring it to use environment variables or a secrets manager.
- The app runs entirely client-side after build; there is no server-side API or database.

---

## Common Pitfalls for Agents

1. **Editing the wrong timer hook** — `useSacredBreathTimer.ts` is the active one. `useBreathTimer.ts` and `useBreathingTimer.ts` are legacy.
2. **Editing the wrong visualizer** — `WebGPUShader.tsx` is the active one. `BreathingVisualizer.tsx` is legacy.
3. **Duplicating `BreathUniforms` in WGSL** — `WebGPUShader.tsx` injects this struct automatically. Adding another definition will cause a compilation error (unless the loader regex happens to strip it).
4. **Assuming tests exist** — Always run `npm run build` and manual browser verification instead of relying on a test suite.
5. **Forgetting static export** — Do not add server-dependent Next.js features (API routes, `getServerSideProps`, etc.) because the build is configured for static export only.

---

## File Reference

| File | Purpose | Status |
|------|---------|--------|
| `app/hooks/useSacredBreathTimer.ts` | Active breath timing + uniform generation | **Active** |
| `app/components/WebGPUShader.tsx` | 8-pass WebGPU pipeline | **Active** |
| `app/components/PostureGuide.tsx` | SVG posture guidance | **Active** |
| `app/page.tsx` | Main page orchestrator | **Active** |
| `app/layout.tsx` | Root layout | **Active** |
| `app/globals.css` | Tailwind v4 styles | **Active** |
| `public/yoga-breath.wgsl` | Base SDF scene shader | **Active** |
| `public/shaders/*.wgsl` | Compute / render passes | **Active** |
| `app/hooks/useBreathTimer.ts` | Legacy timer with rich chakra types | Unused |
| `app/hooks/useBreathingTimer.ts` | Legacy generic timer | Unused |
| `app/components/BreathTimer.tsx` | Legacy rich UI component | Unused |
| `app/components/BreathingVisualizer.tsx` | Legacy simple WebGPU canvas | Unused |
| `deploy.py` | SFTP deployment script | **Active** |
