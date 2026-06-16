#!/usr/bin/env python3
"""Build public/backgrounds/manifest.json from the rendered masters.

Average luminance is computed from the 16:9 master in *perceptual* (sRGB) space
using Rec.709 weights, normalized 0..1, so the shader can auto-compensate
exposure (e.g. lift glow on dark plates, pull back bloom on bright ones).
"""
from __future__ import annotations

import json
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
MASTER_DIR = os.path.join(HERE, "_masters")
OUT = os.path.normpath(os.path.join(HERE, "../../public/backgrounds/manifest.json"))
CROPS = ["16x9", "9x16", "1x1"]
FORMATS = ["avif", "webp", "jpg"]

# id -> presentation + curation metadata.  blendMode/opacity mirror the
# Environment config so the manifest is a single source of truth for tools.
META = {
    "zendo-dawn": dict(
        label="Zendo Dawn", emoji="\U0001FAA7", category="meditation-hall",
        mood="Minimal meditation hall, soft side light",
        suggestedModes=["nervous-system-reg", "classic-mandala"],
        blendMode="soft-light", opacity=0.5),
    "temple-dawn": dict(
        label="Temple Dawn", emoji="\U0001F6D5", category="temple-detail",
        mood="Colonnade silhouette under a dawn glow",
        suggestedModes=["classic-mandala", "sacred-ultra"],
        blendMode="multiply", opacity=0.52),
    "forest-shafts": dict(
        label="Forest Light", emoji="\U0001F332", category="light-bokeh",
        mood="God-rays through forest mist",
        suggestedModes=["prana-flow", "grounding"],
        blendMode="multiply", opacity=0.48),
    "candle-altar": dict(
        label="Candle Altar", emoji="\U0001F56F️", category="temple-detail",
        mood="Warm altar glow with offering bokeh",
        suggestedModes=["nervous-system-reg", "lotus-heart"],
        blendMode="soft-light", opacity=0.55),
    "mist-mandala": dict(
        label="Mist Mandala", emoji="☁️", category="temple-detail",
        mood="Out-of-focus mandala in violet mist",
        suggestedModes=["lotus-heart", "classic-mandala"],
        blendMode="soft-light", opacity=0.45),
    "cosmic-bokeh": dict(
        label="Cosmic Bokeh", emoji="✨", category="cosmic-sky",
        mood="Photographic nebula with coloured bokeh",
        suggestedModes=["sacred-ultra", "deep-release"],
        blendMode="overlay", opacity=0.42),
    "lotus-water": dict(
        label="Lotus Water", emoji="\U0001FAB7", category="natural-texture",
        mood="Abstract rippled pond surface",
        suggestedModes=["prana-flow", "lotus-heart"],
        blendMode="soft-light", opacity=0.5),
    "stone-wabi": dict(
        label="Stone & Wood", emoji="\U0001FAB5", category="natural-texture",
        mood="Warm wood / stone grain, earthy",
        suggestedModes=["grounding"],
        blendMode="multiply", opacity=0.5),
    "twilight-sky": dict(
        label="Twilight Sky", emoji="\U0001F307", category="cosmic-sky",
        mood="Soft dusk gradient, indigo to amber",
        suggestedModes=["deep-release", "sacred-ultra"],
        blendMode="soft-light", opacity=0.5),
    "void-nearblack": dict(
        label="Near-Black Void", emoji="\U0001F311", category="cosmic-sky",
        mood="Very dark plate, faint ember (contrast anchor)",
        suggestedModes=["deep-release", "sacred-ultra"],
        blendMode="normal", opacity=0.6),
    "linen-veil": dict(
        label="Linen Veil", emoji="\U0001F90D", category="light-bokeh",
        mood="High-key sunlight through sheer curtains",
        suggestedModes=["nervous-system-reg"],
        blendMode="multiply", opacity=0.5),
}

ORDER = list(META.keys())


def luminance(path: str) -> float:
    arr = np.asarray(Image.open(path).convert("RGB"), np.float32) / 255.0
    lum = 0.2126 * arr[..., 0] + 0.7152 * arr[..., 1] + 0.0722 * arr[..., 2]
    return round(float(lum.mean()), 4)


def sources(pid: str) -> dict:
    out = {}
    for crop in CROPS:
        out[crop] = {fmt: f"backgrounds/{pid}-{crop}.{fmt}" for fmt in FORMATS}
    return out


def main():
    lums = {pid: luminance(os.path.join(MASTER_DIR, f"{pid}-16x9.png")) for pid in ORDER}
    darkest = min(lums, key=lums.get)
    brightest = max(lums, key=lums.get)

    plates = []
    for pid in ORDER:
        m = META[pid]
        plates.append({
            "id": pid,
            "label": m["label"],
            "emoji": m["emoji"],
            "category": m["category"],
            "mood": m["mood"],
            "credit": "Original procedural artwork — Sacred Breath / generate.py",
            "license": "CC0-1.0 (public-domain-equivalent, self-generated)",
            "suggestedModes": m["suggestedModes"],
            "blendMode": m["blendMode"],
            "opacity": m["opacity"],
            "averageLuminance": lums[pid],
            "tone": ("dark" if lums[pid] < 0.18 else "bright" if lums[pid] > 0.6 else "mid"),
            "isDarkPlate": pid == darkest,
            "isBrightPlate": pid == brightest,
            "sources": sources(pid),
        })

    manifest = {
        "$schema": "./manifest.schema (informal)",
        "version": 1,
        "generator": "assets/backgrounds/generate.py + encode.mjs",
        "description": (
            "Atmospheric background plates for the Sacred Breath app. Rendered to sit "
            "behind the WGSL breath shader at low opacity under theme/chakra tint."
        ),
        "license": "CC0-1.0 — all plates are original, self-generated artwork; free to use.",
        "crops": {"16x9": "1920x1080", "9x16": "1080x1920", "1x1": "1440x1440"},
        "formats": FORMATS,
        "luminanceModel": "Rec.709, sRGB, mean over 16:9 master, normalized 0..1",
        "contrastAnchors": {"darkest": darkest, "brightest": brightest},
        "plates": plates,
    }
    with open(OUT, "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print(f"Wrote {OUT} ({len(plates)} plates)")
    print(f"  darkest:   {darkest} (L={lums[darkest]})")
    print(f"  brightest: {brightest} (L={lums[brightest]})")


if __name__ == "__main__":
    main()
