#!/usr/bin/env python3
"""
Procedural atmospheric background generator for the Sacred Breath yoga app.

These plates are *original, self-generated* artwork (CC0 / public-domain-equivalent).
They are designed to sit behind the WGSL breath shader at ~0.4-0.55 opacity under a
theme/chakra tint and a heavy vignette, so they read as soft, abstract, glowing
atmospheres rather than literal photographs.

Pipeline:
    1. This script renders high-res PNG "masters" natively at 16:9, 9:16 and 1:1
       (no cropping/stretching - every plate is reframed from normalized,
       aspect-corrected coordinate fields so each crop looks intentional).
    2. encode.mjs (sharp) turns each master into webp / avif / jpg.
    3. manifest.py computes average luminance and writes manifest.json.

Run the whole thing with:  python3 assets/backgrounds/build.py
Outputs masters to: assets/backgrounds/_masters/<id>-<crop>.png

Requires: numpy, Pillow.
"""
from __future__ import annotations

import os
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
MASTER_DIR = os.path.join(HERE, "_masters")

# (label, width, height)
CROPS = [
    ("16x9", 1920, 1080),
    ("9x16", 1080, 1920),
    ("1x1", 1440, 1440),
]


# --------------------------------------------------------------------------- #
# Coordinate + colour helpers (all arrays are HxW or HxWx3 float in 0..1)
# --------------------------------------------------------------------------- #
def fields(w: int, h: int):
    """Return coordinate fields.

    xs, ys : 0..1 across width / height
    u, v   : centred (-1..1-ish), aspect-corrected so circles stay round and
             the same scene reframes cleanly across aspect ratios.
    """
    xs = np.linspace(0.0, 1.0, w, dtype=np.float32)[None, :].repeat(h, axis=0)
    ys = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None].repeat(w, axis=1)
    aspect = w / h
    # Centre and scale so the short axis spans -1..1.
    if aspect >= 1.0:
        u = (xs - 0.5) * 2.0 * aspect
        v = (ys - 0.5) * 2.0
    else:
        u = (xs - 0.5) * 2.0
        v = (ys - 0.5) * 2.0 / aspect
    return xs, ys, u, v


def hex_rgb(c: str) -> np.ndarray:
    c = c.lstrip("#")
    return np.array([int(c[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32) / 255.0


def ramp(t: np.ndarray, stops) -> np.ndarray:
    """Map scalar field t (0..1) through colour stops -> HxWx3.

    stops: list of (offset, '#rrggbb').
    """
    t = np.clip(t, 0.0, 1.0)
    offs = [s[0] for s in stops]
    cols = [hex_rgb(s[1]) for s in stops]
    out = np.empty(t.shape + (3,), dtype=np.float32)
    out[...] = cols[0]
    for i in range(1, len(stops)):
        a, b = offs[i - 1], offs[i]
        seg = np.clip((t - a) / max(b - a, 1e-6), 0.0, 1.0)
        seg = seg[..., None]
        out = out * (1.0 - seg) + cols[i] * seg
        out = np.where((t[..., None] >= a), out, out)
    # Clamp anything below first / above last to the end colours.
    out = np.where(t[..., None] <= offs[0], cols[0], out)
    out = np.where(t[..., None] >= offs[-1], cols[-1], out)
    return out


def smooth_noise(w: int, h: int, scale: int, octaves: int = 4, seed: int = 0,
                 persistence: float = 0.5) -> np.ndarray:
    """Fractal value noise in 0..1 via bicubic-upsampled random grids."""
    rng = np.random.default_rng(seed)
    acc = np.zeros((h, w), dtype=np.float32)
    amp, total = 1.0, 0.0
    s = scale
    for _ in range(octaves):
        gh, gw = max(2, int(h / s)), max(2, int(w / s))
        grid = rng.random((gh, gw)).astype(np.float32)
        img = Image.fromarray((grid * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        acc += np.asarray(img, dtype=np.float32) / 255.0 * amp
        total += amp
        amp *= persistence
        s = max(2, s // 2)
    acc /= total
    acc -= acc.min()
    acc /= max(acc.max(), 1e-6)
    return acc


def gblur(arr: np.ndarray, radius: float) -> np.ndarray:
    """Gaussian blur an HxWx3 float array."""
    img = Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8))
    img = img.filter(ImageFilter.GaussianBlur(radius))
    return np.asarray(img, dtype=np.float32) / 255.0


def screen(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    return 1.0 - (1.0 - a) * (1.0 - b)


def soft_disc(u, v, cx, cy, r, feather=0.6):
    """Soft radial disc mask (1 at centre -> 0 at edge), feathered."""
    d = np.sqrt((u - cx) ** 2 + (v - cy) ** 2) / r
    return np.clip(1.0 - d, 0.0, 1.0) ** (1.0 / max(feather, 1e-3))


def vignette(u, v, strength=0.55, radius=1.35):
    d = np.sqrt(u ** 2 + v ** 2) / radius
    return 1.0 - np.clip(d, 0, 1) ** 2 * strength


def grain(w, h, seed, amount=0.012):
    rng = np.random.default_rng(seed + 9999)
    return (rng.standard_normal((h, w, 1)).astype(np.float32)) * amount


def finalize(rgb, u, v, w, h, seed, vig=0.5, grain_amt=0.012):
    rgb = rgb * vignette(u, v, vig)[..., None]
    rgb = rgb + grain(w, h, seed, grain_amt)
    return np.clip(rgb, 0.0, 1.0)


def to_img(rgb) -> Image.Image:
    return Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8), "RGB")


# --------------------------------------------------------------------------- #
# Plate definitions.  Each returns an HxWx3 float array.
# --------------------------------------------------------------------------- #
def p_zendo_dawn(w, h, seed=11):
    xs, ys, u, v = fields(w, h)
    # Warm grey wall fading to a darker floor; gentle horizontal seam ~62%.
    base = ramp(ys, [(0.0, "#3a3530"), (0.45, "#2a2622"), (0.6, "#221d19"),
                     (0.62, "#1b1714"), (1.0, "#0e0b09")])
    # Soft side light pouring from the left like a high window.
    light = np.clip(1.0 - xs / 0.55, 0.0, 1.0) ** 1.6
    light *= np.clip(1.0 - np.abs(ys - 0.32) / 0.5, 0.0, 1.0)
    base = screen(base, (hex_rgb("#caa46a") * 0.5)[None, None, :] * light[..., None])
    # Faint floor reflection of the light.
    refl = np.clip(1.0 - xs / 0.5, 0, 1) ** 2 * np.clip((ys - 0.62) / 0.38, 0, 1)
    base = screen(base, (hex_rgb("#8a6a3a") * 0.22)[None, None, :] * refl[..., None])
    base = gblur(base, 6)
    return finalize(base, u, v, w, h, seed, vig=0.5)


def p_temple_dawn(w, h, seed=21):
    xs, ys, u, v = fields(w, h)
    glow = soft_disc(u, v, 0.0, -0.7, 2.4, feather=0.9)
    base = ramp(np.clip(0.5 - v * 0.5, 0, 1),
                [(0.0, "#0c0608"), (0.4, "#2c160e"), (0.66, "#8a4a22"),
                 (0.85, "#e0a45c"), (1.0, "#ffe0a8")])
    base = base * (0.35 + 0.65 * glow[..., None])
    # Dark colonnade silhouettes.
    pill = np.zeros((h, w), np.float32)
    for cx, wd in [(0.12, 0.045), (0.88, 0.045), (0.30, 0.03), (0.70, 0.03)]:
        pill += np.exp(-((xs - cx) / wd) ** 2)
    pill = np.clip(pill, 0, 1) * np.clip((ys - 0.15), 0, 1)
    base *= (1.0 - 0.85 * pill[..., None])
    # Ground line.
    ground = np.clip((ys - 0.82) / 0.18, 0, 1)
    base *= (1.0 - 0.7 * ground[..., None])
    base = gblur(base, 3)
    return finalize(base, u, v, w, h, seed, vig=0.55)


def p_forest_shafts(w, h, seed=31):
    xs, ys, u, v = fields(w, h)
    base = ramp(ys, [(0.0, "#0a1a10"), (0.4, "#10301c"), (0.7, "#0a2415"),
                     (1.0, "#04100a")])
    # God-rays: tilted bright bands from upper-left.
    angle = 0.35
    p = xs - ys * angle
    rays = np.zeros((h, w), np.float32)
    rng = np.random.default_rng(seed)
    for c in rng.uniform(0.1, 0.9, 7):
        wdt = rng.uniform(0.015, 0.05)
        rays += np.exp(-((p - c) / wdt) ** 2) * rng.uniform(0.4, 1.0)
    rays *= np.clip(1.0 - ys * 0.7, 0.1, 1.0)
    mist = smooth_noise(w, h, 180, 4, seed + 1) * 0.5
    rays = gblur((rays * (0.6 + mist))[..., None].repeat(3, 2), 14)[..., 0]
    base = screen(base, (hex_rgb("#bfe39a") * 0.55)[None, None, :] * rays[..., None])
    # Low ground mist.
    gm = np.clip((ys - 0.6) / 0.4, 0, 1) * smooth_noise(w, h, 120, 3, seed + 2)
    base = screen(base, (hex_rgb("#3c5a40") * 0.4)[None, None, :] * gm[..., None])
    return finalize(base, u, v, w, h, seed, vig=0.5)


def p_candle_altar(w, h, seed=41):
    xs, ys, u, v = fields(w, h)
    base = ramp(ys, [(0.0, "#0a0604"), (0.5, "#160c06"), (1.0, "#070302")])
    # Central candle glow, slightly low.
    glow = soft_disc(u, v, 0.0, 0.15, 0.9, feather=1.2)
    glow = gblur(glow[..., None].repeat(3, 2), 30)[..., 0]
    base = screen(base, ramp(glow, [(0.0, "#000000"), (0.5, "#7a3c10"),
                                    (0.85, "#e08a2c"), (1.0, "#ffe6b0")]) * glow[..., None])
    # Warm bokeh flecks (distant flames / offerings).
    rng = np.random.default_rng(seed)
    bok = np.zeros((h, w), np.float32)
    for _ in range(14):
        cx, cy = rng.uniform(-1.2, 1.2), rng.uniform(-0.8, 0.9)
        r = rng.uniform(0.04, 0.14)
        bok += soft_disc(u, v, cx, cy, r, feather=1.4) * rng.uniform(0.2, 0.6)
    bok = gblur(bok[..., None].repeat(3, 2), 8)[..., 0]
    base = screen(base, (hex_rgb("#ffb860") * 0.5)[None, None, :] * bok[..., None])
    return finalize(base, u, v, w, h, seed, vig=0.6)


def p_mist_mandala(w, h, seed=51):
    xs, ys, u, v = fields(w, h)
    base = ramp(ys, [(0.0, "#241e30"), (0.5, "#1a1626"), (1.0, "#100c18")])
    r = np.sqrt(u ** 2 + v ** 2)
    rings = (np.sin(r * 18.0) * 0.5 + 0.5) * np.clip(1.0 - r / 1.3, 0, 1)
    petals = (np.cos(np.arctan2(v, u) * 12.0) * 0.5 + 0.5)
    mand = rings * (0.5 + 0.5 * petals)
    mand = gblur(mand[..., None].repeat(3, 2), 22)[..., 0]
    base = screen(base, (hex_rgb("#9a86d6") * 0.5)[None, None, :] * mand[..., None])
    mist = smooth_noise(w, h, 200, 4, seed) * 0.5
    base = screen(base, (hex_rgb("#6a5a9a") * 0.3)[None, None, :] * mist[..., None])
    base = gblur(base, 4)
    return finalize(base, u, v, w, h, seed, vig=0.5)


def p_cosmic_bokeh(w, h, seed=61):
    xs, ys, u, v = fields(w, h)
    neb = smooth_noise(w, h, 260, 5, seed)
    base = ramp(neb, [(0.0, "#06030f"), (0.4, "#140a30"), (0.7, "#2a1255"),
                      (0.9, "#5a2a80"), (1.0, "#9a5ab0")])
    base *= (0.55 + 0.45 * smooth_noise(w, h, 120, 4, seed + 7)[..., None])
    # Colourful blurred orbs.
    rng = np.random.default_rng(seed)
    palette = ["#c8b0ff", "#80e8ff", "#ff9ad6", "#a0ffd8"]
    orb = np.zeros((h, w, 3), np.float32)
    for _ in range(9):
        cx, cy = rng.uniform(-1.6, 1.6), rng.uniform(-1.0, 1.0)
        r = rng.uniform(0.08, 0.3)
        m = soft_disc(u, v, cx, cy, r, feather=1.6) * rng.uniform(0.25, 0.6)
        orb += hex_rgb(palette[rng.integers(len(palette))])[None, None, :] * m[..., None]
    orb = gblur(orb, 16)
    base = screen(base, orb)
    # Stars.
    star = (rng.random((h, w)) > 0.9985).astype(np.float32)
    star = gblur(star[..., None].repeat(3, 2), 0.6)[..., 0]
    base = screen(base, star[..., None] * 0.9)
    return finalize(base, u, v, w, h, seed, vig=0.45)


def p_lotus_water(w, h, seed=71):
    xs, ys, u, v = fields(w, h)
    rng = np.random.default_rng(seed)
    # Deep, still pond base with a gentle colour gradient.
    base = ramp(ys,
                [(0.0, "#041a1c"), (0.35, "#0a2f32"), (0.65, "#114845"),
                 (1.0, "#1d5c56")])
    # Concentric ripples from a few distant sources to feel like a real surface.
    ripple = np.zeros((h, w), np.float32)
    for i in range(5):
        cx, cy = rng.uniform(-1.2, 1.2), rng.uniform(-0.8, 0.8)
        r = np.sqrt((u - cx) ** 2 + (v - cy) ** 2)
        freq = rng.uniform(14.0, 24.0)
        ripple += np.sin(r * freq - rng.uniform(0, 6.28)) * np.exp(-r * 0.8)
    ripple = (ripple / 3.0).clip(-1, 1)
    ripple = gblur(ripple[..., None].repeat(3, 2), 2.5)[..., 0]
    # Map ripple crests to slightly lighter teal, troughs to deeper blue-green.
    water = base * (1.0 + ripple[..., None] * 0.25)
    # Specular glints where crests catch a soft overhead light.
    glint = np.clip(ripple - 0.35, 0, 1) ** 2
    glint = gblur(glint[..., None].repeat(3, 2), 4)[..., 0]
    water = screen(water, (hex_rgb("#d4f5e9") * 0.55)[None, None, :] * glint[..., None])
    # Soft out-of-focus lotus-pad shadows (elliptical, darker).
    for _ in range(4):
        cx, cy = rng.uniform(-1.5, 1.5), rng.uniform(-1.0, 1.0)
        rx, ry = rng.uniform(0.25, 0.55), rng.uniform(0.15, 0.35)
        angle = rng.uniform(0, 6.28)
        du = (u - cx) * np.cos(angle) - (v - cy) * np.sin(angle)
        dv = (u - cx) * np.sin(angle) + (v - cy) * np.cos(angle)
        m = np.exp(-((du / rx) ** 2 + (dv / ry) ** 2))
        water *= (1.0 - 0.22 * gblur(m[..., None].repeat(3, 2), 18)[..., 0][..., None])
    # Very faint caustic shimmer.
    caust = smooth_noise(w, h, 160, 3, seed + 2)
    water = screen(water, (hex_rgb("#8fd4c2") * 0.12)[None, None, :]
                   * caust[..., None] * (0.5 + 0.5 * ripple[..., None]))
    return finalize(water, u, v, w, h, seed, vig=0.4, grain_amt=0.008)


def p_stone_wabi(w, h, seed=81):
    xs, ys, u, v = fields(w, h)
    # Diagonal seam: warm wood grain on the left, cool smooth stone on the right.
    seam = np.clip((u + v * 0.3) * 1.3, 0, 1)
    # Long anisotropic wood grain.
    grain_n = smooth_noise(w, h * 3, 50, 5, seed)
    grain_n = np.asarray(Image.fromarray((grain_n * 255).astype(np.uint8))
                         .resize((w, h), Image.BILINEAR), np.float32) / 255.0
    streaks = np.sin(grain_n * 10.0 + ys * 40.0) * 0.5 + 0.5
    wood = ramp((grain_n * 0.5 + streaks * 0.5),
                [(0.0, "#2a1810"), (0.35, "#4a2e1a"), (0.65, "#6f4a2a"),
                 (1.0, "#9a6b3f")])
    # Cool stone area with subtle marbling.
    stone_n = smooth_noise(w, h, 90, 4, seed + 1)
    marble = np.sin(stone_n * 12.0 + u * 5.0) * 0.5 + 0.5
    stone = ramp((stone_n * 0.7 + marble * 0.3),
                 [(0.0, "#1a1e22"), (0.4, "#2e3538"), (0.7, "#444e4f"),
                  (1.0, "#5c6666")])
    # Blend across the diagonal seam with a little blur for softness.
    seam = gblur(seam[..., None].repeat(3, 2), 40)
    base = wood * (1.0 - seam) + stone * seam
    # Soft raking top-left light.
    light = np.clip(1.0 - (xs * 0.3 + ys * 0.7), 0, 1) ** 1.5
    base = screen(base, (hex_rgb("#d4b080") * 0.22)[None, None, :] * light[..., None])
    # Gentle warmth lift on the wood, cool lift on the stone.
    base = screen(base, (hex_rgb("#8a5a30") * 0.08)[None, None, :] * (1.0 - seam))
    base = screen(base, (hex_rgb("#607a80") * 0.08)[None, None, :] * seam)
    base = gblur(base, 1.5)
    return finalize(base, u, v, w, h, seed, vig=0.5)


def p_twilight_sky(w, h, seed=91):
    xs, ys, u, v = fields(w, h)
    base = ramp(ys, [(0.0, "#1a1648"), (0.35, "#2e2160"), (0.6, "#7a3f72"),
                     (0.8, "#d8755a"), (0.93, "#f2b06a"), (1.0, "#ffd9a0")])
    # Subtle cloud banding near the horizon.
    cloud = smooth_noise(w, h, 240, 4, seed) * np.clip(1 - np.abs(ys - 0.72) / 0.3, 0, 1)
    base = screen(base, (hex_rgb("#ffcaa8") * 0.25)[None, None, :]
                  * cloud[..., None])
    # A few high stars in the deep blue.
    rng = np.random.default_rng(seed)
    star = ((rng.random((h, w)) > 0.9990) & (ys < 0.4)).astype(np.float32)
    star = gblur(star[..., None].repeat(3, 2), 0.5)[..., 0]
    base = screen(base, star[..., None] * 0.8)
    base = gblur(base, 2)
    return finalize(base, u, v, w, h, seed, vig=0.35)


def p_void_nearblack(w, h, seed=101):
    xs, ys, u, v = fields(w, h)
    base = ramp(np.sqrt(u ** 2 + v ** 2) / 1.6,
                [(0.0, "#0a0712"), (0.5, "#070510"), (1.0, "#020107")])
    ember = soft_disc(u, v, 0.0, 0.25, 1.4, feather=1.8)
    ember = gblur(ember[..., None].repeat(3, 2), 40)[..., 0]
    base = screen(base, (hex_rgb("#241848") * 0.5)[None, None, :] * ember[..., None])
    n = smooth_noise(w, h, 220, 3, seed) * 0.06
    base = base + n[..., None]
    return finalize(base, u, v, w, h, seed, vig=0.7, grain_amt=0.008)


def p_linen_veil(w, h, seed=111):
    xs, ys, u, v = fields(w, h)
    rng = np.random.default_rng(seed)
    # High-key sheer curtain with warm/cool variation.
    base = ramp(ys,
                [(0.0, "#fbf4e8"), (0.45, "#f5ead4"), (0.75, "#efe2c8"),
                 (1.0, "#e6d6b8")])
    # Soft, irregular vertical folds.
    fold_noise = smooth_noise(w, h, 180, 3, seed)
    folds = np.sin(xs * 18.0 + fold_noise * 4.0 + ys * 4.0) * 0.5 + 0.5
    folds = gblur(folds[..., None].repeat(3, 2), 14)[..., 0]
    base *= (0.88 + 0.18 * folds[..., None])
    # Gentle warm sun bloom from upper right.
    bloom = soft_disc(u, v, 0.55, -0.35, 1.3, feather=1.5)
    bloom = gblur(bloom[..., None].repeat(3, 2), 55)[..., 0]
    base = screen(base, (hex_rgb("#fff6db") * 0.55)[None, None, :] * bloom[..., None])
    # Faint cool shadow from an implied window frame on the left.
    frame_shadow = np.clip(1.0 - (xs / 0.18), 0, 1) ** 1.5
    frame_shadow = gblur(frame_shadow[..., None].repeat(3, 2), 30)[..., 0]
    base *= (1.0 - 0.08 * frame_shadow[..., None])
    # Subtle horizontal light streaks where sun catches fold edges.
    streaks = np.clip(np.sin(ys * 60.0 + fold_noise * 6.0), 0, 1)
    streaks = gblur(streaks[..., None].repeat(3, 2), 8)[..., 0]
    base = screen(base, (hex_rgb("#fff9e6") * 0.2)[None, None, :] * streaks[..., None])
    base = gblur(base, 2.5)
    # Gentle vignette only - keep it high-key.
    base = base * vignette(u, v, 0.15)[..., None]
    base = base + grain(w, h, seed, 0.005)
    return np.clip(base, 0, 1)


PLATES = [
    ("zendo-dawn", p_zendo_dawn),
    ("temple-dawn", p_temple_dawn),
    ("forest-shafts", p_forest_shafts),
    ("candle-altar", p_candle_altar),
    ("mist-mandala", p_mist_mandala),
    ("cosmic-bokeh", p_cosmic_bokeh),
    ("lotus-water", p_lotus_water),
    ("stone-wabi", p_stone_wabi),
    ("twilight-sky", p_twilight_sky),
    ("void-nearblack", p_void_nearblack),
    ("linen-veil", p_linen_veil),
]


def main():
    os.makedirs(MASTER_DIR, exist_ok=True)
    for pid, fn in PLATES:
        for label, w, h in CROPS:
            rgb = fn(w, h)
            out = os.path.join(MASTER_DIR, f"{pid}-{label}.png")
            to_img(rgb).save(out)
            print(f"  rendered {pid}-{label} ({w}x{h})")
    print(f"Done. {len(PLATES)} plates x {len(CROPS)} crops -> {MASTER_DIR}")


if __name__ == "__main__":
    main()
