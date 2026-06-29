# Atmospheric Backgrounds

A curated set of atmospheric background **plates** that sit behind the WGSL breath
shader to complement the app's sacred, minimal, glowing aesthetic.

Plates render at low opacity (`0.42–0.6`) under a theme/chakra tint and a heavy
vignette (see `app/components/EnvironmentBackground.tsx`), so they read as soft,
abstract glows rather than literal photographs. If the photo layer fails to load,
the system gracefully falls back to the solid `#05010a` void.

## The set (11 plates)

| id | label | category | tone | luminance |
|----|-------|----------|------|-----------|
| `zendo-dawn` | Zendo Dawn | meditation hall | mid-dark | 0.10 |
| `temple-dawn` | Temple Dawn | temple detail | dark | 0.13 |
| `forest-shafts` | Forest Light | light & bokeh | dark | 0.13 |
| `candle-altar` | Candle Altar | temple detail | dark | 0.07 |
| `mist-mandala` | Mist Mandala | temple detail | dark | 0.10 |
| `cosmic-bokeh` | Cosmic Bokeh | cosmic / sky | dark | 0.07 |
| `lotus-water` | Lotus Water | natural texture | dark | 0.155 |
| `stone-wabi` | Stone & Wood | natural texture | dark | 0.214 |
| `twilight-sky` | Twilight Sky | cosmic / sky | mid | 0.262 |
| `void-nearblack` | Near-Black Void | cosmic / sky | **dark (anchor)** | 0.044 |
| `linen-veil` | Linen Veil | light & bokeh | **bright (anchor)** | 0.812 |

`void-nearblack` is the very dark / near-black contrast anchor and `linen-veil`
is the high-key bright anchor required for the system's auto-exposure range.

Each plate ships as **3 crops × 3 formats**:

- crops: `16x9` (1920×1080), `9x16` (1080×1920), `1x1` (1440×1440)
- formats: `avif`, `webp`, `jpg` (fallback) — every variant is < 150 kB (budget 800 kB)

File naming: `public/backgrounds/<id>-<crop>.<ext>`,
e.g. `public/backgrounds/cosmic-bokeh-9x16.avif`.

## Manifest

`public/backgrounds/manifest.json` is the single source of truth for tools and
runtime auto-exposure. Per plate it records `id`, `label`, `credit`, `license`,
`category`, `mood`, `suggestedModes`, `blendMode`, `opacity`, `averageLuminance`
(Rec.709, sRGB, 0..1), `tone`, dark/bright anchor flags, and the full responsive
`sources` map. The top level records the contrast anchors and crop/format tables.

## Licensing & credits

**All 11 plates are original, self-generated artwork — CC0-1.0
(public-domain-equivalent).** They are produced procedurally by
`assets/backgrounds/generate.py`; there are no third-party rights to clear. If a
plate is later replaced with a licensed photo or an AI-generated image, update
that plate's `credit` / `license` in the manifest and in this table.

## Rebuilding

```bash
python3 assets/backgrounds/build.py
```

Pipeline:

1. `generate.py` — numpy/Pillow renderer. Renders each plate natively at all
   three aspect ratios from aspect-corrected coordinate fields (no stretching),
   writing PNG masters to `assets/backgrounds/_masters/` (git-ignored).
2. `encode.mjs` — `sharp` encodes each master into avif/webp/jpg in
   `public/backgrounds/`.
3. `manifest.py` — computes average luminance and writes `manifest.json`.

Requirements: Python `numpy` + `Pillow`, Node `sharp`.

## Wiring

- Types: `app/types/environment.ts` (`EnvironmentId` union + `Environment.averageLuminance`)
- Config: `app/data/environments.ts` (`ENVIRONMENTS`, blend/opacity/tint/luminance per plate)
- Renderer: `app/components/EnvironmentBackground.tsx` (`<picture>` avif→webp→jpg,
  cross-fade, Ken Burns, theme/chakra tint, vignette)
- Per-mode defaults: `app/data/sessionModes.ts` (`backgroundId`)

Every `SessionMode` has a default `backgroundId`; users can override per session
(persisted to `localStorage`, validated against the manifest ids). The global
fallback when nothing is chosen is `none` (Cosmic Void / solid color).

## Upgrading to photographic / video assets

These procedural plates are intentionally "good defaults." To swap in licensed or
AI-generated stills or video clips, use the reproducible prompts in
[`prompts.md`](./prompts.md) and keep the same `id`/crop/format naming so the
manifest and wiring keep working.
