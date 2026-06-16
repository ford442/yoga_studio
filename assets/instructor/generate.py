#!/usr/bin/env python3
"""
Generate per-phase *placeholder* instructor clips for the breath guide layer.

Each clip is authored as a FULL-PHASE PERFORMANCE: the figure's movement runs
cleanly from progress 0.0 (first frame) to 1.0 (last frame), so the runtime can
lock it to the breath countdown by either seeking proportionally or by adjusting
playbackRate. A silhouette raises / holds / lowers its arms in lockstep with the
phase, over a phase-tinted glow so phase switches are visually obvious while
testing.

    inhale-raise-01    arms rise   (down -> overhead)
    hold1-arms-high-01 arms held overhead, gentle sway
    exhale-lower-01    arms lower  (overhead -> down)
    hold2-still-01     seated still, soft breathing bob

Outputs mp4 (h264) + webm (vp9) to public/instructor/.
Requires: Pillow, numpy, ffmpeg on PATH.
"""
from __future__ import annotations

import math
import os
import shutil
import subprocess
import tempfile
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "../../public/instructor"))

W, H = 360, 480
FPS = 24

# Phase-tinted glow (matches phaseColors in page.tsx).
TINT = {
    "inhale": (34, 211, 238),   # cyan
    "hold1": (168, 85, 247),    # purple
    "exhale": (250, 146, 60),   # orange
    "hold2": (139, 92, 246),    # violet
}


def lerp(a, b, t):
    return a + (b - a) * t


def arm_points(shoulder, raise_amt, side, sway=0.0):
    """Return (elbow, hand) for one arm.

    raise_amt: 0 = hand down by side, 1 = hand overhead.
    side: -1 left, +1 right.
    """
    sx, sy = shoulder
    L = 70.0
    # Hand offset from shoulder, interpolated down->overhead.
    down = (side * 34.0, 86.0)
    up = (side * 26.0, -92.0)
    hx = sx + lerp(down[0], up[0], raise_amt) + side * sway
    hy = sy + lerp(down[1], up[1], raise_amt)
    # Elbow ~ midpoint, bowed slightly outward.
    ex = (sx + hx) / 2 + side * 14.0 * (1.0 - 0.5 * raise_amt)
    ey = (sy + hy) / 2 + 6.0
    return (ex, ey), (hx, hy)


def render_frame(phase: str, t: float) -> Image.Image:
    """t in 0..1 across the clip."""
    base = Image.new("RGB", (W, H), (8, 6, 14))
    # Radial phase-tinted glow behind the figure.
    glow = Image.new("L", (W, H), 0)
    gd = ImageDraw.Draw(glow)
    cx, cy = W / 2, H * 0.46
    gd.ellipse([cx - 150, cy - 180, cx + 150, cy + 180], fill=120)
    glow = glow.filter(ImageFilter.GaussianBlur(60))
    tint = Image.new("RGB", (W, H), TINT[phase])
    base = Image.composite(tint, base, glow.point(lambda v: int(v * 0.55)))

    # Figure layer (drawn bright, then blurred for a soft body, then composited).
    fig = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    fd = ImageDraw.Draw(fig)

    if phase == "inhale":
        raise_amt, sway, bob = t, 0.0, 0.0
    elif phase == "exhale":
        raise_amt, sway, bob = 1.0 - t, 0.0, 0.0
    elif phase == "hold1":
        raise_amt, sway, bob = 1.0, 8.0 * math.sin(t * math.tau), 0.0
    else:  # hold2
        raise_amt, sway, bob = 0.0, 0.0, 4.0 * math.sin(t * math.tau)

    body_top = H * 0.34 + bob
    shoulder_y = body_top + 26
    lsh = (cx - 30, shoulder_y)
    rsh = (cx + 30, shoulder_y)
    col = (235, 240, 255, 255)
    lw = 16

    # Torso + hips (tapered).
    fd.line([(cx, body_top + 18), (cx, H * 0.66)], fill=col, width=46)
    fd.ellipse([cx - 30, H * 0.62, cx + 30, H * 0.74], fill=col)
    # Head.
    hr = 26
    fd.ellipse([cx - hr, body_top - hr * 2, cx + hr, body_top], fill=col)

    for side, sh in ((-1, lsh), (1, rsh)):
        elbow, hand = arm_points(sh, raise_amt, side, sway)
        fd.line([sh, elbow], fill=col, width=lw)
        fd.line([elbow, hand], fill=col, width=lw)
        fd.ellipse([hand[0] - 9, hand[1] - 9, hand[0] + 9, hand[1] + 9], fill=col)
        fd.ellipse([sh[0] - lw // 2, sh[1] - lw // 2, sh[0] + lw // 2, sh[1] + lw // 2], fill=col)

    # Soft glow copy of the figure, then the crisp figure on top.
    soft = fig.filter(ImageFilter.GaussianBlur(7))
    base = base.convert("RGBA")
    base.alpha_composite(soft)
    base.alpha_composite(fig.filter(ImageFilter.GaussianBlur(1.2)))

    # Vignette.
    vig = Image.new("L", (W, H), 0)
    ImageDraw.Draw(vig).ellipse([-60, -60, W + 60, H + 60], fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(70))
    black = Image.new("RGBA", (W, H), (4, 2, 9, 255))
    base = Image.composite(base, black, vig)
    return base.convert("RGB")


def encode(name: str, phase: str, duration: float):
    n = max(2, round(duration * FPS))
    tmp = tempfile.mkdtemp()
    try:
        for i in range(n):
            t = i / (n - 1)
            render_frame(phase, t).save(os.path.join(tmp, f"f{i:04d}.png"))
        pattern = os.path.join(tmp, "f%04d.png")
        mp4 = os.path.join(OUT, f"{name}.mp4")
        webm = os.path.join(OUT, f"{name}.webm")
        common = ["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS),
                  "-i", pattern]
        subprocess.run(common + ["-c:v", "libx264", "-pix_fmt", "yuv420p",
                                  "-profile:v", "high", "-crf", "26",
                                  "-movflags", "+faststart", mp4], check=True)
        subprocess.run(common + ["-c:v", "libvpx-vp9", "-pix_fmt", "yuv420p",
                                  "-b:v", "0", "-crf", "36", "-row-mt", "1",
                                  webm], check=True)
        kb_mp4 = os.path.getsize(mp4) / 1024
        kb_webm = os.path.getsize(webm) / 1024
        print(f"  {name:22} {duration:.1f}s  mp4={kb_mp4:.0f}kB webm={kb_webm:.0f}kB")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


CLIPS = [
    ("inhale-raise-01", "inhale", 4.0),
    ("hold1-arms-high-01", "hold1", 3.0),
    ("exhale-lower-01", "exhale", 4.0),
    ("hold2-still-01", "hold2", 3.0),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, phase, dur in CLIPS:
        encode(name, phase, dur)
    print(f"Done -> {OUT}")


if __name__ == "__main__":
    main()
