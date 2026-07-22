# Yoga Studio — Sacred Breath Timer

An AI coding agent guide for this Next.js React application featuring a WebGPU-powered breathing visualization, session-based pranayama timing, voice guidance, and practice stats.

---

## Project Overview

**Yoga Studio** is a full-screen pranayama practice companion. It displays a large breath-phase countdown, an animated WebGPU visualization of a sacred monk silhouette with mandala and particle effects, and a suite of supporting features: timed sessions, breath presets, theme switching, voice guidance (English / Sanskrit), practice stats with streak tracking, and a PWA install prompt.

`page.tsx` is a thin composition root (~270 lines): it mounts `SessionProvider` (breath-timer state + derived intensity/phase timing) and wires together the feature components and hooks under `app/features/` and `app/hooks/`. It holds no business logic of its own beyond a handful of local UI-visibility flags (settings drawer, program selector) and prop plumbing.

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
├── page.tsx                      # Composition root: SessionProvider + feature wiring only
├── globals.css                   # Tailwind v4 import + CSS variables
├── features/                     # Page-level feature slices (own context/state + UI)
│   ├── session/
│   │   ├── SessionProvider.tsx   # Context: useBreathTimer + derived intensity/phaseProgress
│   │   ├── deriveSessionPhase.ts # Pure functions: computePhaseTiming, computeIntensity (unit tested)
│   │   ├── BreathCanvas.tsx      # Pointer-driven ripple/mouse uniforms + WebGPUShader
│   │   ├── StatsHeader.tsx       # Top bar: title + today's minutes/breaths/streak + export
│   │   ├── PhaseDisplay.tsx      # Phase label + countdown + progress ring + avatar
│   │   └── SessionControls.tsx   # Bottom bar: resume/program/mode-switcher/quick-start/begin-pause
│   ├── settings/
│   │   └── SettingsDrawer.tsx    # ⚙️ drawer: environment, instructor guide, renderer, phase sliders
│   └── practice/
│       └── PracticeShell.tsx     # Welcome panel + guided intro tour composition
├── components/
│   ├── WebGPUShader.tsx          # Single-pass WebGPU renderer (sacred-monk.wgsl)
│   ├── InstallPrompt.tsx         # PWA beforeinstallprompt install button
│   ├── ExportStats.tsx           # Generates 1080×1080 PNG of today's practice stats
│   └── CompletionScreen.tsx      # Session-end overlay with confetti animation
└── hooks/
    ├── useBreathTimer.ts         # Core breathing logic, presets, session auto-end
    ├── useBreathAudio.ts         # Phase-transition chimes + ambient drone
    ├── useVoiceGuidance.ts       # SpeechSynthesis voice guidance (EN / Sanskrit)
    ├── useSessionStats.ts        # localStorage-backed stats (minutes, breaths, streak)
    ├── useRippleAudio.ts         # Interactive ripple sound on canvas pointer move
    ├── useLastSession.ts         # Persists/restores the last-practiced mode+duration
    ├── usePracticeSession.ts     # Technique selection, favorites, start/pause/program handlers
    ├── useSessionCompletion.ts   # Completion detection, completion-overlay state, next-step logic
    └── useIntroTourFlow.ts       # First-run guided tour show/skip/complete state
```

> **Agent caution:** Session-state (breath phase, timer, derived intensity) lives in `SessionProvider`/`useSession()` — read it via context rather than re-deriving it or threading new props through `page.tsx`. Mode selection, program session tracking, and completion-overlay state live in `usePracticeSession` / `useSessionCompletion` respectively; extend those hooks instead of adding new `useState` calls directly in `page.tsx`.

> **Agent caution:** When modifying behavior, edit `useBreathTimer.ts` and `WebGPUShader.tsx` — the app's only timer hook and single-pass WebGPU renderer.

### Static Assets

```
public/                           # Runtime assets only (copied to out/)
├── sacred-monk.wgsl              # Active scene shader (mandala + monk SDF + particles)
├── sacred-lotus-final.wgsl       # Active lotus + ribbons shader
├── sacred-ultra.wgsl             # Active cinematic ultra shader
├── yoga-regular.wgsl             # Active simplified clinical-calm shader
├── manifest.webmanifest          # PWA manifest
├── backgrounds/                  # Runtime background images
└── instructor/                   # Runtime instructor clips

archive/shaders/                  # Non-public historical preservation
├── legacy/                       # Superseded reference shaders
│   ├── yoga-breath.wgsl
│   ├── yoga-visuals.wgsl
│   ├── yoga-fixed.wgsl
│   └── yoga.glsl
├── experiments/                  # Multi-pass / modular / swarm experiments
│   ├── bloom-compute.wgsl
│   ├── particle-compute.wgsl
│   ├── particle-render.wgsl
│   ├── aurora-compute.wgsl
│   ├── composite.wgsl
│   ├── breath-swarm-merged.wgsl
│   ├── breath-swarm-next.wgsl
│   ├── energy-ribbons.wgsl
│   ├── lotus-ethereal.wgsl
│   └── yoga-{light,strong,regular}.wgsl / .glsl
└── generated/                    # Agent outputs and summary docs
    ├── Kimi_Agent_Sacred Breath Shader.zip
    └── YOGA_SHADER_REFACTOR_SUMMARY.md
```

See `docs/shaders/SHADER_INVENTORY.md` for the full asset manifest.

#### Instructor video reshoot workflow

Filmed instructor clips are derived assets, not hand-authored ones. To add or replace a clip:

1. Drop the mp4 in `assets/video/<name>.mp4`.
2. Run `npm run media:instructor` (requires `ffmpeg`/`ffprobe` on `PATH`). This copies the mp4 into `public/instructor/`, encodes a VP9/Opus `.webm` fallback and a first-frame `.webp` poster, probes the real duration/dimensions/audio via `ffprobe`, and regenerates `app/data/instructorClips.generated.json`.
3. Reference `<name>` from `app/data/instructorVideos.ts` via `clip('<name>', label)` — durations come from the generated manifest, never hardcode them. `clip()` throws at import time if `<name>` isn't in the manifest.
4. Commit the mp4/webm/webp under `public/instructor/`, the source mp4 under `assets/video/`, and the updated `instructorClips.generated.json`.

`npm run validate:content` cross-checks that every manifest entry has its mp4/webm/webp on disk and that every clip referenced from `instructorVideos.ts` exists in the manifest — run it before pushing. Encoding is a dev-machine step; CI only validates the committed outputs.

### Configuration Files

| File | Purpose |
|------|---------|
| `next.config.ts` | Static export, no `basePath`, `assetPrefix: './'`, optional `NEXT_PUBLIC_BASE_PATH` for sub-path hosts |
| `tsconfig.json` | ES2017, strict, bundler resolution, `@/*` → `./*` |
| `postcss.config.mjs` | Tailwind v4 PostCSS plugin |
| `eslint.config.mjs` | Flat ESLint config with Next.js web-vitals + typescript presets |
| `webgpu.d.ts` | `/// <reference types="@webgpu/types" />` |
| `deploy.py` | SFTP deployment script (see Deployment) |

---

## WebGPU Shader Architecture

`WebGPUShader.tsx` is a **single-pass** renderer. It fetches the active `.wgsl` file (e.g. `public/sacred-monk.wgsl`) at runtime, creates one render pipeline, and draws a full-screen triangle.

### Uniform Buffer Layout

The React side writes a 72-byte uniform buffer every frame. The single source of truth for field order, types, defaults, and byte offsets is **`app/lib/shaderContract.ts`**. All active shaders must declare an identical `struct Uniforms`.

Active shaders:
- `public/sacred-monk.wgsl`
- `public/sacred-lotus-final.wgsl`
- `public/sacred-ultra.wgsl`
- `public/yoga-regular.wgsl`

Run the dev-time validator after any layout change:

```bash
npm run validate:shaders
```

**Critical:** When adding or reordering uniforms, update `app/lib/shaderContract.ts` first, then update every active `.wgsl` file, and run `npm run validate:shaders` to catch drift. `WebGPUShader.tsx` now reads the buffer size and field order from the contract, so it should not need manual index updates. WebGPU will hard crash (blank canvas) on size or layout mismatch.

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

The project now uses **Vitest** for unit/hook tests and **Playwright** for browser/export smoke tests.

```bash
# Run unit/hook tests (deterministic, jsdom)
npm test

# Run unit tests in watch mode
npm run test:watch

# Run a single test file
npx vitest run app/hooks/__tests__/useBreathTimer.test.ts

# Run static export smoke checks (files present + HTTP 200s)
npm run smoke

# Run Playwright browser smoke tests (requires `npx playwright install`)
npm run test:e2e
```

### Playwright setup

Browser binaries are not installed by `npm install`. One-time setup:

```bash
npx playwright install chromium
```

In CI, prefer `npx playwright install --with-deps chromium`.

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

### Deploy
```bash
export DEPLOY_TOKEN="your_long_token_from_vps_env"
python deploy.py
```

- `deploy.py` zips the `out/` directory and uploads it as a single bundle to `storage.noahcohn.com`.
- `DEPLOY_TOKEN` **must** be set in the environment; the script exits immediately with an error if it is missing. Never hardcode the token in the file.
- If the `out/` directory is missing, the script prints an error reminding you to run `npm run build` first.

### Static Hosting
Because `next.config.ts` sets `output: 'export'`, the `out/` folder is a complete static site and can be served by any static host (Netlify, Vercel, GitHub Pages, S3, etc.).

- No `basePath` is set, and `assetPrefix: './'` produces relative asset URLs, so the export works at the root of any domain or behind a reverse proxy that strips a sub-path prefix.
- If the host serves `out/` directly under a sub-path **without** stripping the prefix (e.g. GitHub Pages project sites), build with:
  ```bash
  NEXT_PUBLIC_BASE_PATH=/yoga npm run build
  ```
  This prefix is applied by `app/lib/resolveAssetUrl.ts` to runtime-fetched public assets.

---

## Security Considerations

- `deploy.py` requires `DEPLOY_TOKEN` to be set in the environment (`export DEPLOY_TOKEN=...`) and refuses to run without it. **Never** hardcode a token value in this file or commit one — the repo's CI runs gitleaks and GitHub push protection to catch this.
- The app runs entirely client-side after build; there is no server-side API or database.
- `localStorage` is used for stats and voice settings; no sensitive data is stored.

---

## Common Pitfalls for Agents

1. **`useBreathTimer.ts` is the only timer hook** — there is no legacy alternative to confuse it with.
2. **`WebGPUShader.tsx` is the only visualizer** — there is no legacy alternative to confuse it with.
3. **Old multi-pass shaders are unused** — Legacy shader files now live in `archive/shaders/` (legacy reference shaders, multi-pass compute passes, and swarm experiments). They are not loaded by the active component. See `docs/shaders/SHADER_INVENTORY.md` for the full manifest.
4. **Duplicating `Uniforms` struct in WGSL** — The active shader already declares `struct Uniforms`. Adding another definition will cause a compilation error.
5. **Editing uniform indices by hand** — The buffer layout lives in `app/lib/shaderContract.ts` and is consumed by `WebGPUShader.tsx` and the WebGL2 fallback. Update the contract and run `npm run validate:shaders` rather than chasing magic indices.
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
| `app/components/TechniquesLibrary.tsx` | Techniques Library UI (goals, science sheet) | **Active** |
| `app/components/TechniqueScienceSheet.tsx` | Per-technique science detail sheet | **Active** |
| `app/data/techniques.ts` | Named technique profiles (source of truth) | **Active** |
| `app/data/sessionModes.ts` | Re-exports `TECHNIQUES` for compatibility | **Active** |
| `TECHNIQUES.md` | Technique catalog & shader mappings | **Active** |
| `app/page.tsx` | Main page orchestrator | **Active** |
| `app/layout.tsx` | Root layout | **Active** |
| `app/globals.css` | Tailwind v4 styles | **Active** |
| `public/manifest.webmanifest` | PWA manifest | **Active** |
| `public/sacred-monk.wgsl` | Active scene shader | **Active** |
| `public/sacred-lotus-final.wgsl` | Active lotus + ribbons shader | **Active** |
| `public/sacred-ultra.wgsl` | Active cinematic ultra shader | **Active** |
| `public/yoga-regular.wgsl` | Active simplified clinical-calm shader | **Active** |
| `docs/shaders/SHADER_INVENTORY.md` | Shader asset manifest | **Active** |
| `archive/shaders/legacy/*` | Superseded reference shaders | Archived |
| `archive/shaders/experiments/*` | Multi-pass / modular / swarm experiments | Archived |
| `archive/shaders/generated/*` | Agent outputs and summary docs | Archived |
| `archive/shaders/swarm-outputs/*` | Consolidated ultra shaders from earlier swarms | Archived |
| `deploy.py` | SFTP deployment script | **Active** |

---

## Cursor Cloud specific instructions

- Dependency install is `npm install` (Node 22, npm 10). This runs automatically on VM startup as the update script.
- Standard commands are in `package.json`: `npm run dev` (dev server on `http://localhost:3000`), `npm run lint`, `npm run build` (static export to `out/`).
- `npm start`/`npm run preview` serve the pre-built `out/` via `npx serve`; run `npm run build` first.
- Run the dev server as a long-lived process (e.g. tmux), not a blocking foreground call.
- WebGPU **does** render in this environment's Chrome — the cosmic/mandala visualization shows correctly, so verify canvas visuals via the browser, not just a black-canvas assumption.
- `npm run lint` emits 3 pre-existing `react-hooks/exhaustive-deps` warnings (0 errors); this is the expected clean baseline.
- No automated test suite exists; validate changes with `npm run build` plus manual browser checks (see Manual Testing Checklist above).
- `next.config.ts` uses `output: 'export'` with `assetPrefix: './'` and `trailingSlash: true`; do not add server-only Next.js features.

---

## Commit / PR Hygiene

- Write commit messages and PR titles that describe the actual change (e.g. `fix: correct phase timing rounding`), not placeholders like `add` or `codepit`.
- Don't commit session debris — logs, one-off debug scripts, editor scratch files — even temporarily; add it to `.gitignore` or delete it before committing.
- Generated files (e.g. `public/sw.js`, built by `prebuild`) should never be tracked; if a build step produces a file, gitignore it and let CI/consumers regenerate it.
