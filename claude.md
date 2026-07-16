# Claude.md - Development Guide for Yoga Studio

This document provides context for Claude Code sessions working on this project.

## Quick Project Summary

**Yoga Studio** is a full-screen pranayama practice companion. It features:

- Session-based 4-phase breath timer (`inhale` → `hold1` → `exhale` → `hold2`)
- WebGPU-powered sacred visualization (monk silhouette, mandala, particles, energy ribbons, lotus)
- 6 visualization presets (Sacred Ultra, Lotus Heart, Prana Flow, Sacred Geometry, Deep Release, Grounding) driven by `SessionModeSwitcher`
- Voice guidance (English + Sanskrit), phase chimes, ambient drone, and interactive ripple audio
- Practice stats with daily minutes, breath count, and streak tracking (localStorage)
- PWA install prompt and stats PNG export

**Tech Stack:** Next.js 16 (static export) + React 19 + TypeScript + Tailwind CSS v4 + WebGPU / WGSL

> **Primary source of truth:** See [AGENTS.md](./AGENTS.md) for detailed architecture, shader internals, and active vs. legacy file guidance.

## Repository Structure (Active Files)

```
app/
├── page.tsx                      # Main orchestrator: timer, modes, WebGPU, stats, settings
├── layout.tsx
├── globals.css
├── components/
│   ├── WebGPUShader.tsx          # Single-pass WebGPU renderer (fetches .wgsl at runtime)
│   ├── SessionModeSwitcher.tsx   # 6 visualization preset buttons
│   ├── CompletionScreen.tsx      # End-of-session overlay + confetti
│   ├── ExportStats.tsx           # 1080×1080 PNG stats export
│   ├── InstallPrompt.tsx         # PWA beforeinstallprompt handler
│   └── ThemeSwitcher.tsx         # (legacy in current UI flow)
├── hooks/
│   ├── useBreathTimer.ts         # Core timer + presets + session auto-end (ACTIVE)
│   ├── useBreathAudio.ts         # Phase chimes + ambient drone
│   ├── useVoiceGuidance.ts       # SpeechSynthesis (EN / Sanskrit)
│   ├── useSessionStats.ts        # localStorage stats + streak logic
│   └── useRippleAudio.ts         # Canvas pointer ripple sounds
├── data/sessionModes.ts          # 6 visualization presets with shaderPath + theme + strengthLevel
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

**Legacy files (present but not imported by page.tsx):** `useSacredBreathTimer.ts`, `useBreathingTimer.ts`, `PostureGuide.tsx`, `BreathingVisualizer.tsx`, `BreathTimer.tsx` (deleted).

## Key Technologies

- Next.js App Router, static export (`output: 'export'`)
- WebGPU single-pass rendering with 64-byte uniform buffer (16 × f32)
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
- Phase durations are controlled by presets in `SESSION_MODES` or the custom settings drawer
- `phaseProgress` (0–1 within current phase) is computed in page.tsx and passed to the shader for bloom/ribbon timing

### Session Modes (visualization presets)
- Each mode selects a different `.wgsl` shader + theme + mandalaStyle + optional `strengthLevel`
- Modes do **not** change breath timing by default (timing is independent)
- Default mode: "Sacred Ultra" (`sacred-ultra.wgsl`)

### strengthLevel (added 2026)
- Visualization intensity uniform: `0.0 = light`, `1.0 = regular (default)`, `2.0 = strong`
- Passed through `WebGPUShader` props → 64-byte uniform buffer → `u.strengthLevel` in WGSL
- Currently all modes default to `1.0`. Can be used inside shaders to scale particle count, glow intensity, ribbon density, etc.
- **Critical:** Always update the struct in *all three* active WGSL files + the TS buffer write + buffer size (64) together.

### Uniform Buffer Layout (64 bytes / 16 floats)
See AGENTS.md "WebGPU Shader Architecture" section for the exact field order and padding. The layout is deliberately mirrored in:
- `WebGPUShader.tsx` (Float32Array + `device.createBuffer({ size: 64 })`)
- `sacred-monk.wgsl`, `sacred-lotus-final.wgsl`, `sacred-ultra.wgsl`, `yoga-regular.wgsl`

Mismatch = instant WebGPU validation error (blank canvas).

## File-by-File Guide (Active Only)

### `app/hooks/useBreathTimer.ts` (the one you should edit)
- Returns: `breathPhase`, `currentPhase`, `isRunning`, `settings`, `sessionDuration`, `totalBreaths`, `startSession(minutes)`, `toggleFree()`, `reset()`, `updateSettings()`, `endSession()`
- Presets live in `SESSION_MODES`; custom durations come from the drawer in page.tsx

### `app/components/WebGPUShader.tsx`
- Props include all uniforms: `breathPhase`, `intensity`, `phaseProgress`, `theme`, `mandalaStyle`, `strengthLevel`, `mouse`, `mouseStrength`, plus `shaderPath` / entry points
- Fetches the chosen `.wgsl` at runtime, creates one render pipeline, writes the 64-byte uniform buffer every frame
- No `updateUniforms` ref method — data flows via props + internal `propsRef`

### `app/page.tsx`
- Computes `intensity` and `phaseProgress` from current phase + settings
- Wires mouse/touch ripples to shader + audio
- Owns the SessionModeSwitcher, stats display, custom settings drawer, and completion screen trigger

### `app/data/sessionModes.ts` + `app/types/sessionMode.ts`
- Source of truth for the 6 visualization presets
- Each entry declares `shaderPath`, `theme`, `mandalaStyle`, and optional `strengthLevel`

### Audio / Voice / Stats hooks
- `useBreathAudio.ts` — 432/528/396/639 Hz chimes + low drone
- `useVoiceGuidance.ts` — `speechSynthesis` with EN/Sanskrit strings, 180 ms delay after phase change
- `useSessionStats.ts` — daily reset + streak logic on `hold2 → inhale` transition
- `useRippleAudio.ts` — rate-limited sine blips on canvas pointer move

## Common Tasks

### Adding or Modifying a Visualization Preset
1. Edit `app/data/sessionModes.ts` (add new entry or tweak `shaderPath` / `theme` / `strengthLevel`)
2. If using a new shader file, ensure it declares the exact 16-field `Uniforms` struct (see AGENTS.md)
3. Test in browser; verify no WebGPU errors in DevTools console

### Changing the Uniform Layout (strengthLevel, new fields, etc.)
You **must** update in lockstep:
- `app/components/WebGPUShader.tsx` — buffer size (64), Float32Array order, propsRef, interface
- All three active WGSL files — `struct Uniforms` + padding fields
- `app/data/sessionModes.ts` / `app/types/sessionMode.ts` if the new value should be per-mode
- Update the layout table in AGENTS.md

### Adding a New Active Shader
- Place it in `public/`
- Reference it from a new or existing entry in `SESSION_MODES`
- Declare the identical `Uniforms` struct at the top (copy from `sacred-monk.wgsl`)
- Add it to the "must update together" list in AGENTS.md

### Adjusting Breath Timing Presets
- Edit the `breath` object inside entries in `SESSION_MODES`
- Or let users tweak live via the custom settings drawer (calls `updateSettings` on `useBreathTimer`)

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
- Most common cause: uniform struct in WGSL does not exactly match the 64-byte TS layout
- Verify you updated *all three* active `.wgsl` files when changing uniforms

**Timer not advancing or phases stuck**
- Check `isRunning` and that `useBreathTimer` is the hook imported in page.tsx
- Legacy `useSacredBreathTimer.ts` is not wired to the current UI

**New shader looks wrong or crashes**
- Confirm it declares the exact `struct Uniforms` (16 fields + padding) that the other active shaders use
- Check that `shaderPath`, `vertexEntry`, and `fragmentEntry` in the mode are correct

## Resources

- [AGENTS.md](./AGENTS.md) — Authoritative architecture, shader layout table, active/legacy file list, deployment notes
- README.md — User-facing overview
- Next.js, Tailwind v4, and WebGPU specs as usual

When in doubt, read the active source files (`useBreathTimer.ts`, `WebGPUShader.tsx`, the three `.wgsl` files in `public/`, and `sessionModes.ts`) rather than legacy experiments.
