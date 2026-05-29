# Yoga Studio — Sacred Breath Timer

An AI coding agent guide for this Next.js React application featuring a WebGPU-powered breathing visualization, session-based pranayama timing, voice guidance, and practice stats.

---

## Project Overview

**Yoga Studio** is a full-screen pranayama practice companion. It displays a large breath-phase countdown, an animated WebGPU visualization of a sacred monk silhouette with mandala and particle effects, and a suite of supporting features: timed sessions, breath presets, theme switching, voice guidance (English / Sanskrit), practice stats with streak tracking, and a PWA install prompt.

The runtime architecture is intentionally minimal but has grown beyond a single hook: `page.tsx` orchestrates one timer hook, one WebGPU canvas, and several small UI components and effect hooks.

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
├── manifest.ts                   # PWA manifest (force-static)
├── page.tsx                      # Main page: countdown, controls, WebGPU, stats, settings
├── globals.css                   # Tailwind v4 import + CSS variables
├── components/
│   ├── WebGPUShader.tsx          # Single-pass WebGPU renderer (sacred-monk.wgsl)
│   ├── InstallPrompt.tsx         # PWA beforeinstallprompt install button
│   ├── ExportStats.tsx           # Generates 1080×1080 PNG of today's practice stats
│   ├── CompletionScreen.tsx      # Session-end overlay with confetti animation
│   └── ThemeSwitcher.tsx         # Theme (Cosmic/Golden/Ocean) + mandala style toggles
└── hooks/
    ├── useBreathTimer.ts         # Core breathing logic, presets, session auto-end
    ├── useBreathAudio.ts         # Phase-transition chimes + ambient drone
    ├── useVoiceGuidance.ts       # SpeechSynthesis voice guidance (EN / Sanskrit)
    ├── useSessionStats.ts        # localStorage-backed stats (minutes, breaths, streak)
    └── useRippleAudio.ts         # Interactive ripple sound on canvas pointer move
```

### Legacy / Unused Files (present but not imported by `page.tsx`)

| File | Status | Note |
|------|--------|------|
| `app/components/PostureGuide.tsx` | Unused | SVG stick-figure with rotating arms; not imported by current page |
| `app/components/BreathingVisualizer.tsx` | Unused | Simpler WebGPU canvas with inline WGSL |
| `app/hooks/useSacredBreathTimer.ts` | Unused | Older timer with strength levels and chakra uniform generation |
| `app/hooks/useBreathingTimer.ts` | Unused | Generic 4-phase timer hook with `globalProgress` |

> **Agent caution:** When modifying behavior, edit `useBreathTimer.ts` and `WebGPUShader.tsx`, not the legacy files above, unless you are explicitly reviving them.

### Static Assets

```
public/
├── sacred-monk.wgsl              # Active scene shader (mandala + monk SDF + particles)
├── shaders/
│   ├── bloom-compute.wgsl        # Legacy bright extract + Gaussian blur (unused)
│   ├── particle-compute.wgsl     # Legacy particle simulation (unused)
│   ├── particle-render.wgsl      # Legacy particle instanced quads (unused)
│   ├── aurora-compute.wgsl       # Legacy aurora background (unused)
│   ├── composite.wgsl            # Legacy final blend pass (unused)
│   └── breath-swarm-merged.wgsl  # Swarm experiment outputs (unused by page)
├── yoga-breath.wgsl              # Legacy base SDF scene shader (unused)
├── yoga.glsl                     # Original GLSL reference (legacy)
├── yoga-regular.wgsl             # WGSL reference (legacy)
└── yoga-fixed.wgsl               # WGSL reference fix (legacy)
```

### Configuration Files

| File | Purpose |
|------|---------|
| `next.config.ts` | Static export, `basePath: '/yoga'` |
| `tsconfig.json` | ES2017, strict, bundler resolution, `@/*` → `./*` |
| `postcss.config.mjs` | Tailwind v4 PostCSS plugin |
| `eslint.config.mjs` | Flat ESLint config with Next.js web-vitals + typescript presets |
| `webgpu.d.ts` | `/// <reference types="@webgpu/types" />` |
| `deploy.py` | SFTP deployment script (see Deployment) |

---

## WebGPU Shader Architecture

`WebGPUShader.tsx` is a **single-pass** renderer. It fetches `public/sacred-monk.wgsl` at runtime, creates one render pipeline, and draws a full-screen triangle.

### Uniform Buffer Layout

The React side writes a 64-byte uniform buffer (16 × `f32`) every frame. All three active shaders (`sacred-monk.wgsl`, `sacred-lotus-final.wgsl`, `sacred-ultra.wgsl`) must declare an identical `struct Uniforms`.

```
offset  0  time            f32
offset  4  breathPhase     f32   // 0–1 full cycle progress
offset  8  intensity       f32
offset 12  chakraPhase     f32   // 0–3 mapped to phase
offset 16  theme           f32   // 0=Cosmic, 1=Golden, 2=Ocean
offset 20  mandalaStyle    f32   // 0=Lotus, 1=Yantra, 2=Flower
offset 24  phaseProgress   f32   // 0–1 progress within current phase (for petal/ribbon timing)
offset 28  strengthLevel   f32   // 0.0=light, 1.0=regular (default), 2.0=strong — scales particle/glow density
offset 32  mouse.x         f32   // -1..1 or -2 when inactive
offset 36  mouse.y         f32
offset 40  mouseStrength   f32   // 0..1
offset 44  padding0        f32   // 16-byte alignment
offset 48  resolution.x    f32
offset 52  resolution.y    f32
offset 56  padding1        f32
offset 60  padding2        f32
```

**Critical:** When adding or reordering uniforms, update **all three** active WGSL files + `WebGPUShader.tsx` buffer size (64) + Float32Array write order in lockstep. WebGPU will hard crash (blank canvas) on size or layout mismatch.

The shader defines its own `struct Uniforms` at the top of each active `.wgsl` file. Do **not** duplicate this struct elsewhere.

### Shader Features

- **Cosmic background** — starfield generated with a hash
- **Volumetric light shafts** — 5 rotating beams tinted by breath phase
- **Mandala** — radial pattern with 3 selectable styles (`u.mandalaStyle`)
- **Particles** — 9 drifting light points
- **Sacred monk silhouette** — SDF stick figure with breath-pulse scaling
- **Neon glow halos** — 4 nested glow rings around the monk
- **Interactive ripple** — mouse/touch distortion on the canvas
- **Theme color shifts** — `u.theme` modifies the neon hue multipliers

### Texture Resizing

The canvas dimensions are driven by `clientWidth/clientHeight × devicePixelRatio`. On window resize the canvas is resized; the shader reads the new resolution from the uniform buffer.

---

## Breath Timing System

### Active Hook: `useBreathTimer.ts`

This is the single source of truth for breath state.

#### Returned API

```typescript
{
  breathPhase: number,          // 0–1 cycle progress
  isRunning: boolean,
  currentPhase: 'inhale' | 'hold1' | 'exhale' | 'hold2',
  settings: BreathSettings,     // { inhale, hold1, exhale, hold2 }
  sessionDuration: 5 | 10 | 15 | null,
  totalBreaths: number,
  startSession: (minutes) => void,
  toggleFree: () => void,       // start/pause free-form session
  reset: () => void,
  updateSettings: (Partial<BreathSettings>) => void,
  endSession: () => void,
}
```

#### Default Durations

- `inhale`: 4s
- `hold1`: 4s
- `exhale`: 6s
- `hold2`: 2s

#### Built-in Presets

| Preset | inhale | hold1 | exhale | hold2 |
|--------|--------|-------|--------|-------|
| box    | 4      | 4     | 4      | 4     |
| 478    | 4      | 7     | 8      | 0     |
| sigh   | 4      | 0     | 6      | 8     |
| free   | 5      | 3     | 7      | 2     |

#### Session Behavior

- `startSession(minutes)` starts a timed session and resets `totalBreaths`.
- A `requestAnimationFrame` loop advances `breathPhase` continuously.
- When `sessionDuration` elapses, the hook auto-calls `endSession()`.
- `toggleFree()` toggles running state for untimed practice.

#### Countdown Logic in page.tsx

`page.tsx` computes the remaining seconds for the current phase from `breathPhase` and `settings` (not from the hook). The large numeric display is `Math.max(0, remaining).toFixed(0)`.

---

## Audio & Feedback Systems

### `useBreathAudio.ts`

- Phase-transition chimes using `AudioContext` oscillators:
  - inhale → 432 Hz sine
  - hold1  → 528 Hz triangle
  - exhale → 396 Hz sine
  - hold2  → 639 Hz triangle
- Ambient low drone (110 Hz sine, very quiet) while running
- `toggleMute()` mutes/unmutes all generated audio

### `useVoiceGuidance.ts`

- Uses `window.speechSynthesis` to announce each phase change
- Messages in English and Sanskrit:
  - Puraka / Kumbhaka / Rechaka / Shunyaka
- 180 ms delay after phase change to avoid overlapping chimes
- Settings persisted to `localStorage` under `sacred-breath-voice`

### `useRippleAudio.ts`

- Short sine burst (80–300 Hz) triggered by canvas pointer movement
- Rate-limited to once per 100 ms

---

## Session Stats & Persistence

### `useSessionStats.ts`

- Stores `todayMinutes`, `todayBreaths`, `currentStreak`, `lastPracticeDate` in `localStorage` under `sacred-breath-stats`.
- Resets daily counters when `lastPracticeDate` is not today.
- Streak logic: increments if last practice was yesterday; resets to 1 if gap is larger.
- `addPracticeTime(seconds)` is called on every full cycle completion (`hold2` → `inhale` transition).

### `ExportStats.tsx`

- Draws a 1080×1080 canvas with radial-gradient background, mandala rings, and large stats typography.
- Downloads as `sacred-breath-{YYYY-MM-DD}.png`.

---

## PWA & Install Support

- `app/manifest.ts` exports a Next.js `MetadataRoute.Manifest` with `display: 'standalone'`.
- `InstallPrompt.tsx` listens for `beforeinstallprompt`, shows a floating "INSTALL APP" button, and calls `.prompt()` on click.
- Hides automatically when `display-mode: standalone` matches.

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
- The active shader (`sacred-monk.wgsl`) defines its own `struct Uniforms`; do not inject a second definition
- Entry points in the active shader are `vs` (vertex) and `main` (fragment)

---

## Testing Instructions

### Automated Tests
**There are no automated tests.** The project does not include Jest, Vitest, Playwright, Cypress, or any other test framework.

### Manual Testing Checklist

When making changes, verify the following in a WebGPU-compatible browser (Chrome/Edge 113+):

- [ ] `npm run dev` starts without TypeScript or ESLint errors
- [ ] Page loads and shows "SACRED BREATH" title with 5 MIN / 10 MIN / 15 MIN buttons
- [ ] Pressing a duration button starts a timed session
- [ ] Pressing BEGIN starts free-form practice
- [ ] Phases cycle through: inhale → hold1 → exhale → hold2
- [ ] Countdown decrements each second
- [ ] Breath ring SVG stroke animates with `breathPhase`
- [ ] Cycle count increments after each full round
- [ ] Pause stops the timer; resume continues
- [ ] Reset returns to cycle 0, phase inhale
- [ ] Preset buttons (BOX, 478, SIGH, FREE) update durations
- [ ] Custom settings drawer sliders change phase durations
- [ ] WebGPU canvas renders (not black) — check for shader compilation errors in DevTools
- [ ] Mouse/touch on canvas triggers ripple distortion and sound
- [ ] Theme buttons change visual colors
- [ ] Mandala style buttons change pattern
- [ ] Voice guidance toggle speaks phase names
- [ ] Sanskrit toggle switches to Sanskrit terms
- [ ] Mute toggle silences chimes and drone
- [ ] Completion screen appears when timed session ends
- [ ] Export Stats button downloads a PNG
- [ ] Stats (MIN TODAY, BREATHS, STREAK) update after each cycle
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
- `localStorage` is used for stats and voice settings; no sensitive data is stored.

---

## Common Pitfalls for Agents

1. **Editing the wrong timer hook** — `useBreathTimer.ts` is the active one. `useSacredBreathTimer.ts` and `useBreathingTimer.ts` are legacy.
2. **Editing the wrong visualizer** — `WebGPUShader.tsx` is the active one. `BreathingVisualizer.tsx` is legacy.
3. **PostureGuide is unused** — `PostureGuide.tsx` exists but is not imported by `page.tsx`. Do not assume it renders.
4. **Old multi-pass shaders are unused** — Files in `public/shaders/` (bloom, particle, aurora, composite) and `public/yoga-breath.wgsl` are not loaded by the active component. The only active shader is `public/sacred-monk.wgsl`.
5. **Duplicating `Uniforms` struct in WGSL** — The active shader already declares `struct Uniforms`. Adding another definition will cause a compilation error.
6. **Assuming tests exist** — Always run `npm run build` and manual browser verification instead of relying on a test suite.
7. **Forgetting static export** — Do not add server-dependent Next.js features (API routes, `getServerSideProps`, etc.) because the build is configured for static export only.

---

## File Reference

| File | Purpose | Status |
|------|---------|--------|
| `app/hooks/useBreathTimer.ts` | Active breath timing, presets, session auto-end | **Active** |
| `app/hooks/useBreathAudio.ts` | Phase chimes + ambient drone | **Active** |
| `app/hooks/useVoiceGuidance.ts` | Speech synthesis guidance | **Active** |
| `app/hooks/useSessionStats.ts` | localStorage stats & streak | **Active** |
| `app/hooks/useRippleAudio.ts` | Interactive ripple sound | **Active** |
| `app/components/WebGPUShader.tsx` | Single-pass WebGPU renderer | **Active** |
| `app/components/InstallPrompt.tsx` | PWA install prompt | **Active** |
| `app/components/ExportStats.tsx` | Stats PNG export | **Active** |
| `app/components/CompletionScreen.tsx` | Session completion overlay | **Active** |
| `app/components/ThemeSwitcher.tsx` | Theme & mandala style toggles | **Active** |
| `app/page.tsx` | Main page orchestrator | **Active** |
| `app/layout.tsx` | Root layout | **Active** |
| `app/manifest.ts` | PWA manifest | **Active** |
| `app/globals.css` | Tailwind v4 styles | **Active** |
| `public/sacred-monk.wgsl` | Active scene shader | **Active** |
| `app/components/PostureGuide.tsx` | SVG posture guidance | Unused |
| `app/components/BreathingVisualizer.tsx` | Legacy simple WebGPU canvas | Unused |
| `app/hooks/useSacredBreathTimer.ts` | Legacy timer with chakra uniforms | Unused |
| `app/hooks/useBreathingTimer.ts` | Legacy generic timer | Unused |
| `public/shaders/*.wgsl` | Legacy compute / render passes | Unused |
| `public/yoga-breath.wgsl` | Legacy base SDF scene shader | Unused |
| `deploy.py` | SFTP deployment script | **Active** |
