# Claude.md - Development Guide for Yoga Studio

This document provides context for Claude Code sessions working on this project.

## Quick Project Summary

**Yoga Studio** is a full-screen pranayama practice companion. It features:

- Session-based 4-phase breath timer (`inhale` → `hold1` → `exhale` → `hold2`)
- WebGPU-powered sacred visualization (monk silhouette, mandala, particles, energy ribbons, lotus) with a WebGL2 fallback and adaptive quality governor
- 9 technique presets (Box Breathing, Nadi Shodhana, Ujjayi, Lotus Heart, Grounding, Prana Flow, Deep Release, Coherent Breath, Sacred Ultra) defined in `app/data/techniques.ts` and driven by `SessionModeSwitcher`
- Voice guidance (English + Sanskrit), phase chimes, ambient drone, and interactive ripple audio
- Practice stats with daily minutes, breath count, and streak tracking (localStorage), plus session history/trends and multi-day programs
- PWA install prompt and stats PNG export

**Tech Stack:** Next.js 16 (static export) + React 19 + TypeScript + Tailwind CSS v4 + WebGPU / WGSL

> **Primary source of truth:** See [AGENTS.md](./AGENTS.md) for detailed architecture, shader internals, and active vs. legacy file guidance.

## Repository Structure (Active Files)

```
app/
├── page.tsx                      # Composition root: <SessionProvider><PracticeProvider><PracticeScreen /></...>
├── layout.tsx
├── globals.css
├── features/                     # Page-level feature slices (own context/state + UI)
│   ├── session/
│   │   ├── SessionProvider.tsx   # Context: wraps useBreathTimer, derives intensity via deriveSessionPhase.ts
│   │   ├── BreathCanvas.tsx      # Pointer-driven ripple/mouse uniforms + ShaderCanvas
│   │   ├── PhaseDisplay.tsx      # Phase label + countdown + progress ring + avatar
│   │   ├── SessionControls.tsx   # Bottom bar: resume/program/mode-switcher/quick-start/begin-pause
│   │   └── StatsHeader.tsx       # Top bar: title + today's minutes/breaths/streak + export
│   ├── practice/
│   │   ├── PracticeProvider.tsx  # Context: wires up all the other feature hooks (stats, voice, programs, ...)
│   │   ├── PracticeScreen.tsx    # The actual page UI, composes every feature component
│   │   └── PracticeShell.tsx     # Welcome panel + guided intro tour composition
│   └── settings/
│       └── SettingsDrawer.tsx    # ⚙️ drawer: environment, instructor guide, renderer, phase sliders
├── components/
│   ├── ShaderCanvas.tsx          # Renderer shell: picks WebGPU/WebGL2/static backend, quality governor
│   ├── SessionModeSwitcher.tsx   # Technique preset buttons
│   ├── CompletionScreen.tsx      # End-of-session overlay + confetti
│   ├── ExportStats.tsx           # 1080×1080 PNG stats export
│   └── InstallPrompt.tsx         # PWA beforeinstallprompt handler
├── renderer/                     # Renderer backends + shared rendering infra
│   ├── selectBackend.ts          # probeCapabilities / mountRenderer / pickInitialMode
│   ├── webgpuBackend.ts / webgl2Backend.ts / staticBackend.ts
│   ├── frameGovernor.ts          # Adaptive quality/resolution tiering
│   ├── quality.ts, overlay.ts, gpuChores/
├── hooks/
│   ├── useBreathTimer.ts         # Core timer + schedule + session auto-end (ACTIVE)
│   ├── useBreathAudio.ts         # Phase chimes + ambient drone
│   ├── useVoiceGuidance.ts       # SpeechSynthesis (EN / Sanskrit)
│   ├── useSessionStats.ts        # localStorage stats + streak logic
│   ├── usePracticeSession.ts     # Technique selection, favorites, start/pause/program handlers
│   └── useRippleAudio.ts         # Canvas pointer ripple sounds
├── data/techniques.ts             # Source of truth for technique presets (shaderPath + theme + strengthLevel)
├── data/sessionModes.ts           # @deprecated re-export of techniques.ts — do not add new entries here
└── types/sessionMode.ts

public/                           # Runtime assets only
├── sacred-monk.wgsl              # Classic mandala + monk silhouette
├── sacred-lotus-final.wgsl       # Lotus + prana ribbons + ethereal
├── sacred-ultra.wgsl             # Master composition (ribbons, figure, chakras, lotus, post)
├── yoga-regular.wgsl             # Simplified clinical-calm shader
├── manifest.webmanifest          # PWA manifest
├── backgrounds/                  # Runtime background images
└── instructor/                   # Runtime instructor clips

archive/shaders/                  # Non-public preservation
├── legacy/                       # Superseded yoga-*.wgsl / .glsl reference shaders
├── experiments/                  # Multi-pass / modular / swarm experiments
└── generated/                    # Agent outputs and summary docs

docs/shaders/SHADER_INVENTORY.md  # Active vs legacy vs experimental manifest
```

## Key Technologies

- Next.js App Router, static export (`output: 'export'`)
- WebGPU rendering (WebGL2/static fallback) with a 72-byte uniform buffer defined in `app/lib/shaderContract.ts`
- Tailwind v4 via `@import "tailwindcss"`
- All audio via Web Audio API + SpeechSynthesis (no media files)

## Development Workflow

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # outputs to out/
npm run lint
```

## Important Concepts (Current Architecture)

### Breath Phases (useBreathTimer.ts)
- `inhale` | `hold1` | `exhale` | `hold2`
- Phase durations build a `BreathSchedule` (`app/lib/breathSchedule.ts`) from presets in `TECHNIQUES` (`app/data/techniques.ts`) or the custom settings drawer
- `phaseProgress` and `remaining` come straight off the hook's schedule lookup (`resolvePhaseAt`), not computed downstream — see "Breath Timing System" in AGENTS.md
- `intensity` (used for bloom/ribbon timing) is derived from `phaseProgress` by `computeIntensity()` in `app/features/session/deriveSessionPhase.ts`, inside `SessionProvider`

### Techniques (visualization + breathing presets)
- Each technique in `app/data/techniques.ts` selects a `.wgsl` shader + theme + mandalaStyle + `strengthLevel` + its own default breath ratio and science/guidance copy
- Selecting a technique also updates breath timing (unlike the old "session modes" which were visuals-only)
- Default mode: "Sacred Ultra" (`sacred-ultra.wgsl`)

### strengthLevel
- Visualization intensity uniform: `0.0 = light`, `1.0 = regular (default)`, `2.0 = strong`
- Passed through `ShaderCanvas` props → 72-byte uniform buffer → `u.strengthLevel` in WGSL
- Set per-technique in `app/data/techniques.ts`. Can be used inside shaders to scale particle count, glow intensity, ribbon density, etc.
- **Critical:** Always update `app/lib/shaderContract.ts` + every active WGSL file's `struct Uniforms` together, then run `npm run validate:shaders`.

### Uniform Buffer Layout (72 bytes / 16 fields)
`app/lib/shaderContract.ts` is the single source of truth for field order, types, defaults, and byte offsets — see AGENTS.md "WebGPU Shader Architecture" for the full table. The layout is mirrored in:
- `ShaderCanvas.tsx` / `app/renderer/webgpuBackend.ts` (buffer built via `buildUniformBuffer()`)
- `sacred-monk.wgsl`, `sacred-lotus-final.wgsl`, `sacred-ultra.wgsl`, `yoga-regular.wgsl`

Mismatch = instant WebGPU validation error (blank canvas). Run `npm run validate:shaders` after any layout change.

## File-by-File Guide (Active Only)

### `app/hooks/useBreathTimer.ts` (the one you should edit)
- Returns: `breathPhase`, `currentPhase`, `phaseProgress`, `remaining`, `isRunning`, `settings`, `sessionDuration`, `totalBreaths`, `getPhaseSnapshot()`, `startSession(minutes)`, `toggleFree()`, `reset()`, `updateSettings()`, `endSession()`
- Presets live in `TECHNIQUES`; custom durations come from the drawer in `SettingsDrawer.tsx`

### `app/features/session/SessionProvider.tsx`
- Wraps `useBreathTimer` in a context (`useSession()`) and derives `intensity` via `deriveSessionPhase.ts`
- Read timer/phase state via `useSession()` rather than re-deriving it or threading new props through `page.tsx`

### `app/features/practice/PracticeProvider.tsx`
- Wires up every other feature hook (stats, voice, programs, onboarding, renderer settings, instructor video) behind `usePractice()`
- `usePracticeSession()` owns technique selection, favorites, and start/pause/program handlers

### `app/components/ShaderCanvas.tsx`
- Props include all uniforms: `breathPhase`, `intensity`, `phaseProgress`, `theme`, `mandalaStyle`, `strengthLevel`, `mouse`, `mouseStrength`, `chakraFocus`, `geometryDensity`, `interference`, `figurePose`, `qualityPreset`, plus `shaderPath` / entry points
- Delegates to `app/renderer/selectBackend.ts` to pick a WebGPU/WebGL2/static backend, and to `frameGovernor.ts` for adaptive quality; does not fetch/render shaders itself
- Writes the 72-byte uniform buffer every frame via `app/lib/shaderContract.ts`

### `app/features/practice/PracticeScreen.tsx`
- The actual page UI: composes `BreathCanvas`, `PhaseDisplay`, `SessionControls`, `StatsHeader`, `SettingsDrawer`, `CompletionScreen`, etc. from `useSession()` + `usePractice()`
- `app/page.tsx` itself is just `<SessionProvider><PracticeProvider><PracticeScreen /></PracticeProvider></SessionProvider>`

### `app/data/techniques.ts` + `app/types/sessionMode.ts`
- Source of truth for the technique presets (9 as of this writing)
- Each entry declares `shaderPath`, `theme`, `mandalaStyle`, `strengthLevel`, default `breath` ratio, and technique/science copy
- `app/data/sessionModes.ts` is a `@deprecated` re-export (`SESSION_MODES`/`DEFAULT_MODE`) kept for backward compatibility — don't add new entries there

### Audio / Voice / Stats hooks
- `useBreathAudio.ts` — 432/528/396/639 Hz chimes + low drone
- `useVoiceGuidance.ts` — `speechSynthesis` with EN/Sanskrit strings, 180 ms delay after phase change
- `useSessionStats.ts` — daily reset + streak logic on `hold2 → inhale` transition
- `useRippleAudio.ts` — rate-limited sine blips on canvas pointer move

## Common Tasks

### Adding or Modifying a Technique
1. Edit `app/data/techniques.ts` (add new entry or tweak `shaderPath` / `theme` / `strengthLevel` / `breath`)
2. If using a new shader file, ensure it declares the exact 16-field `Uniforms` struct (see AGENTS.md)
3. Test in browser; verify no WebGPU errors in DevTools console

### Changing the Uniform Layout (strengthLevel, new fields, etc.)
You **must** update in lockstep:
- `app/lib/shaderContract.ts` — field list, byte offsets, buffer size
- All active WGSL files — `struct Uniforms` + padding fields
- `app/data/techniques.ts` / `app/types/sessionMode.ts` if the new value should be per-technique
- Run `npm run validate:shaders`

### Adding a New Active Shader
- Place it in `public/`
- Reference it from a new or existing entry in `TECHNIQUES`
- Declare the identical `Uniforms` struct at the top (copy from `sacred-monk.wgsl`)
- Add it to the "must update together" list in AGENTS.md

### Adjusting Breath Timing Presets
- Edit the `breath` object inside entries in `TECHNIQUES`
- Or let users tweak live via the custom settings drawer (calls `updateSettings` on `useBreathTimer` through `useSession()`)

## Testing Checklist (Manual)

- [ ] `npm run dev` starts cleanly; no TS or ESLint errors
- [ ] Page loads with title, 5/10/15 MIN buttons, and BEGIN
- [ ] Selecting a session mode switches shaders/visuals without crash
- [ ] Phases cycle correctly; large countdown decrements
- [ ] Mouse/touch on canvas produces ripple distortion + sound
- [ ] Voice guidance toggle speaks (and Sanskrit toggle changes language)
- [ ] Timed session ends with CompletionScreen + confetti
- [ ] Export Stats downloads a labeled PNG
- [ ] Stats (MIN TODAY / BREATHS / STREAK) update after full cycles
- [ ] `npm run build` succeeds and `out/` is usable

## Linting, Build, Deployment

```bash
npm run lint
npm run build
python deploy.py   # SFTP deploy (see AGENTS.md for security note on credentials)
```

Static export means no API routes or `getServerSideProps`.

## Browser Support

- Chrome / Edge 113+ — Full WebGPU
- Safari Technology Preview — WebGPU available
- Firefox — No WebGPU (will show black canvas or console error)

## Quick Troubleshooting

**WebGPU canvas is black / rendering aborts**
- Open DevTools → Console for shader compilation or buffer size errors
- Most common cause: uniform struct in WGSL does not exactly match the 72-byte TS layout (`app/lib/shaderContract.ts`)
- Verify you updated *all* active `.wgsl` files when changing uniforms, then ran `npm run validate:shaders`
- `ShaderCanvas` also falls back to WebGL2 or a static image if WebGPU init fails — check `RendererDiagnostics`/`GpuErrorBanner` for the reported stage

**Timer not advancing or phases stuck**
- Check `isRunning` and that `useSession()` (backed by `useBreathTimer`) is being read, not a stale local copy

**New shader looks wrong or crashes**
- Confirm it declares the exact `struct Uniforms` (16 fields + padding) that the other active shaders use
- Check that `shaderPath`, `vertexEntry`, and `fragmentEntry` in the mode are correct

## Resources

- [AGENTS.md](./AGENTS.md) — Authoritative architecture, shader layout table, active/legacy file list, deployment notes
- README.md — User-facing overview
- Next.js, Tailwind v4, and WebGPU specs as usual

When in doubt, read the active source files (`useBreathTimer.ts`, `ShaderCanvas.tsx` + `app/renderer/`, the active `.wgsl` files in `public/`, and `techniques.ts`) rather than legacy experiments.
