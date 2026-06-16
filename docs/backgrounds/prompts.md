# Background Generation Prompts (Stills + Video)

Reproducible prompts for regenerating or upgrading each plate with an AI
image/video model (or as an art-direction brief for a photographer/licensor).

**Shared style spine** — prepend to any prompt:

> Sacred, minimal, glowing meditative atmosphere. Soft volumetric light, shallow
> depth of field, gentle film grain, no people, no text, no logos, no harsh
> highlights. Composition reads beautifully abstract at full-bleed and stays
> legible when darkened and tinted behind a UI. Calm, reverent, spacious.

**Technical, every asset**

- Aspect ratios: 16:9, 9:16, 1:1 (request all three / re-crop intentionally).
- Stills → export avif + webp + jpg, keep each variant < 800 kB.
- Naming: `public/backgrounds/<id>-<crop>.<ext>` (e.g. `cosmic-bokeh-9x16.avif`).
- Keep the existing `id` so the manifest and wiring keep working.
- After importing, recompute `averageLuminance` (run `assets/backgrounds/manifest.py`
  or measure mean Rec.709 luminance) and update `manifest.json`.
- Maintain the contrast range: at least one near-black plate (`void-nearblack`,
  L≈0.04) and one high-key plate (`linen-veil`, L≈0.80).

---

## Still prompts (per plate)

### zendo-dawn — Minimalist meditation hall
> Empty minimalist zendo / meditation hall at dawn, bare tatami floor, a single
> shaft of warm side light from a tall window on the left, soft grey-brown walls,
> deep shadow on the right, serene emptiness, architectural calm.

### temple-dawn — Temple colonnade at dawn
> Silhouetted stone temple colonnade against a glowing amber dawn sky, pillars
> receding into mist, warm-to-dark vertical gradient, soft out-of-focus, reverent.

### forest-shafts — God-rays through forest
> Volumetric god-rays piercing through misty old-growth forest, deep emerald
> greens, dust motes in light beams, soft low ground fog, dappled and dreamy.

### candle-altar — Candle altar glow
> Out-of-focus temple altar at night, a single warm candle flame glowing at
> center, scattered offering-light bokeh, deep warm shadows, intimate and sacred.

### mist-mandala — Mandala in mist
> A traditional mandala wall painting seen through soft violet incense mist,
> heavily out of focus, concentric petals dissolving into haze, muted jewel tones.

### cosmic-bokeh — Photographic nebula bokeh
> Dreamy photographic nebula, soft coloured bokeh orbs (lavender, cyan, rose),
> faint distant stars, deep indigo-to-violet gradient, gentle cosmic glow.

### lotus-water — Lotus pond surface
> Extreme close-up of a still lotus-pond surface, gentle ripples and specular
> glints, teal-green water, a couple of soft out-of-focus lotus-pad shadows,
> abstract and meditative.

### stone-wabi — Stone & wood grain
> Macro wabi-sabi texture of weathered warm wood grain meeting smooth river
> stone, earthy browns and ochre, soft raking top light, grounding and tactile.

### twilight-sky — Soft twilight gradient
> Clean soft twilight sky gradient, deep indigo at the top easing to rose and
> warm amber at the horizon, a few faint high stars, smooth banded clouds.

### void-nearblack — Near-black contrast anchor  *(keep very dark, L≈0.04)*
> Near-black meditative void, almost pure darkness with a single faint indigo
> ember glow low-center, barely-there grain, infinite depth. Minimal, deep.

### linen-veil — High-key light study  *(keep bright, L≈0.80)*
> High-key sunlight diffusing through sheer white linen curtains, warm near-white
> with soft vertical folds, a gentle sun bloom in the upper corner, airy and bright.

---

## Video clip prompts (loopable ambient motion)

For ambient motion behind the breath UI. Keep it **slow and seamless**.

**Shared video direction** — prepend:

> Subtle, slow, seamless loop. Almost-still ambient motion (drifting light, haze,
> sparkle, or gentle ripple) — no camera cuts, no fast movement, no people.
> 8–12 s, designed to loop without a visible seam. Calm and hypnotic.

**Technical, every clip**

- Encode `webm` (VP9/AV1) + `mp4` (H.264) fallback; target < 3 MB, ≤ 1080p.
- Provide a poster still (reuse the matching plate's `-16x9.jpg`).
- Suggested home: `public/backgrounds/video/<id>.{webm,mp4}` (+ manifest entry
  when the renderer gains a video layer).

| id | motion brief |
|----|--------------|
| `zendo-dawn` | dust motes drifting slowly through the side light shaft; almost imperceptible light flicker |
| `temple-dawn` | dawn glow brightening/dimming on a slow breath cadence; faint mist creeping between pillars |
| `forest-shafts` | god-rays gently swaying as leaves move offscreen; dust motes rising slowly |
| `candle-altar` | single candle flame flickering softly; warm bokeh twinkling out of focus |
| `mist-mandala` | incense smoke curling upward across a static mandala; slow focus breathing |
| `cosmic-bokeh` | bokeh orbs drifting and twinkling; nebula clouds slowly churning |
| `lotus-water` | slow concentric ripples spreading across the pond; specular glints shimmering |
| `stone-wabi` | near-still; only a slow raking-light sweep across the grain |
| `twilight-sky` | clouds drifting almost imperceptibly; stars faintly twinkling |
| `void-nearblack` | the faint ember pulsing very slowly on a breath rhythm; grain shimmer |
| `linen-veil` | sheer curtains billowing gently in a soft breeze; sun bloom shifting slowly |

---

## Procedural fallback

`assets/backgrounds/generate.py` reproduces the current CC0 plate set without any
external model. Treat these prompts as the upgrade path; the procedural plates are
the always-available default.
