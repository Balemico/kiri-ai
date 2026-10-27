#!/usr/bin/env python3
"""Procedural placeholder art for the lobby intro (brush strokes, leaf, calligraphy, veil).

Placeholders only: real art comes from the Nano-Banana + cutout_layers.py pipeline and simply
overwrites these files. Strokes/veil/calligraphy are WHITE (or black) on TRANSPARENT — the
stroke/veil PNGs are consumed as CSS mask-images, so white = visible, transparent = cut.
"""
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "public" / "images" / "intro"
OUT.mkdir(parents=True, exist_ok=True)


def brush_stroke(w, h, seed, taper=0.75):
    """Bristle-simulated dry brush stroke. Hundreds of individual bristle tracks deposit ink
    along a pressured, wavering baseline; where tracks overlap the ink saturates to a solid
    core, where they thin out (edges, tail) they leave real dry-brush streaks and flying
    white. Alpha = ink density (greys = dilution)."""
    rng = np.random.default_rng(seed)
    t = np.linspace(0.0, 1.0, w)

    def noise1d(cells, lo, hi):
        pts = rng.random(cells)
        return np.interp(np.linspace(0, cells - 1, w), np.arange(cells), pts) * (hi - lo) + lo

    # Pressure along the gesture: fast press-down, breathing body, ragged release at the tail.
    attack = np.clip(t * 22, 0, 1) ** 0.6
    release = np.clip((1 - t) / (1 - taper), 0, 1) ** 0.65 if taper < 1 else np.ones(w)
    press = attack * release * (0.62 + 0.38 * np.sin(t * np.pi)) * noise1d(9, 0.72, 1.06)
    # Lift the brush inside the frame: the gesture starts and ends on the paper, not at the crop.
    press = press * np.clip((t - 0.012) * 45, 0, 1) * np.clip((0.99 - t) * 28, 0, 1)

    # Baseline: the wrist wavers, it doesn't sine-wave.
    base = h * 0.5 + noise1d(5, -h * 0.07, h * 0.07) + noise1d(11, -h * 0.025, h * 0.025)

    yy = np.arange(h, dtype=np.float32)

    def smooth1d(a, k):
        k = max(3, int(k) | 1)
        win = np.hanning(k)
        return np.convolve(a, win / win.sum(), mode="same")

    half = h * 0.34 * (0.10 + 0.90 * press)  # half-width of the wet band, converging at the lifts
    # Ragged contour: multi-octave noise per lip, smoothed so no polygon corners survive.
    lip_t = 1 + smooth1d(noise1d(12, -0.14, 0.26) + noise1d(40, -0.11, 0.11) + noise1d(140, -0.05, 0.05), w / 90)
    lip_b = 1 + smooth1d(noise1d(12, -0.14, 0.26) + noise1d(40, -0.11, 0.11) + noise1d(140, -0.05, 0.05), w / 90)
    top = base - half * lip_t
    bot = base + half * lip_b
    # Solid fill between the lips with a ~1px wet edge.
    alpha = np.clip(np.minimum(yy[:, None] - top[None, :], bot[None, :] - yy[:, None]) / 1.4, 0.0, 1.0)
    alpha = alpha.astype(np.float32) * np.clip(press * 8, 0, 1)[None, :]

    # Flying white: streaks CARVED out of the solid body with crisp, jittered edges —
    # thin sparse ones anywhere, widening dry breakup toward the tail.
    rel = (yy[:, None] - base[None, :]) / np.maximum(half, 1e-3)[None, :]  # -1..1 inside the band
    for _ in range(18):
        r0 = rng.uniform(-0.9, 0.9)
        drift = noise1d(int(rng.integers(6, 12)), -0.10, 0.10) + noise1d(int(rng.integers(30, 55)), -0.03, 0.03)
        ramp = np.clip((t - rng.uniform(0.35, 0.85)) * rng.uniform(2.5, 6.0), 0, 1)
        sputter = np.clip(noise1d(int(rng.integers(14, 26)), -0.5, 1.3), 0, 1)
        strength = ramp * sputter * rng.uniform(0.85, 1.0)
        width = rng.uniform(0.015, 0.06) + 0.20 * np.clip((t - 0.55) / 0.45, 0, 1) * rng.uniform(0.3, 1.0)
        jit = noise1d(int(rng.integers(40, 90)), -0.12, 0.12)
        d = np.abs(rel - (r0 + drift)[None, :]) / np.maximum(width, 1e-3)[None, :]
        cut = np.clip((1 + jit[None, :] - d) / 0.3, 0, 1)  # steep edge = white, not grey
        alpha -= cut * strength[None, :]
    # Snap the murk: push half-carved greys toward ink or paper (real ink pools or breaks).
    alpha = np.clip((alpha - 0.06) / 0.94, 0, 1) ** 1.15
    # Dry fringe: the outer band frays into horizontally-elongated bristle filaments.
    fil = np.asarray(
        Image.fromarray((rng.random((h // 2, max(2, w // 28))) * 255).astype(np.uint8), "L").resize((w, h), Image.BILINEAR),
        dtype=np.float32,
    ) / 255.0
    fray = np.clip((np.abs(rel) - 0.72) / 0.28, 0, 1) * np.clip(t * 1.6 - 0.2, 0, 1)[None, :]
    alpha -= np.clip((fil - (1 - fray * 0.75)) / 0.12, 0, 1)
    # Ink pooling: the core stays essentially solid, breathing a little.
    grain = np.asarray(
        Image.fromarray((rng.random((5, 18)) * 255).astype(np.uint8), "L").resize((w, h), Image.BILINEAR),
        dtype=np.float32,
    ) / 255.0
    alpha = np.clip(alpha, 0.0, 1.0) * (0.93 + 0.07 * grain)

    # A handful of splatter flecks, hugging the gesture (mostly off the tail).
    for _ in range(7):
        fx = int(np.clip(rng.uniform(0.3, 1.02) * w, 0, w - 1))
        fy = int(np.clip(base[min(fx, w - 1)] + rng.normal(0, h * 0.30), 2, h - 3))
        rx, ry = rng.uniform(1.5, 7.0), rng.uniform(0.8, 2.4)
        x0, x1 = int(max(0, fx - 3 * rx)), int(min(w, fx + 3 * rx))
        if x1 <= x0:
            continue
        gx = np.exp(-((np.arange(x0, x1) - fx) ** 2) / (2 * rx * rx))
        gy = np.exp(-((yy - fy) ** 2) / (2 * ry * ry))
        fleck = np.clip((gy[:, None] * gx[None, :] - 0.35) / 0.65, 0, 1) * rng.uniform(0.7, 1.0)
        alpha[:, x0:x1] = np.maximum(alpha[:, x0:x1], fleck)

    alpha = np.clip(alpha, 0.0, 1.0)
    alpha[alpha < 0.05] = 0.0
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[..., :3] = 255
    rgba[..., 3] = (alpha * 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def maple_leaf(size, seed):
    """A 5-lobed vermilion maple leaf silhouette."""
    rng = random.Random(seed)
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = size / 2
    pts = []
    for i in range(240):
        a = i / 240 * 2 * math.pi
        lobes = 0.62 + 0.38 * abs(math.cos(a * 2.5 + rng.uniform(-0.04, 0.04)))
        r = c * 0.92 * lobes
        pts.append((c + r * math.sin(a), c - r * math.cos(a) * 1.06))
    d.polygon(pts, fill=(183, 50, 37, 255))
    d.line([(c, c * 0.2), (c, size * 0.98)], fill=(120, 28, 20, 255), width=max(1, size // 42))
    return img


def calligraphy(w, h):
    """Vertical kanji column, black on transparent. Falls back to abstract strokes without a CJK font."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    text = "霧合の決闘"
    font = None
    for p in ["/System/Library/Fonts/Hiragino Sans GB.ttc", "/System/Library/Fonts/STHeiti Medium.ttc",
              "/System/Library/Fonts/Supplemental/Songti.ttc"]:
        try:
            font = ImageFont.truetype(p, int(w * 0.72))
            break
        except OSError:
            continue
    if font:
        step = h / (len(text) + 0.5)
        for i, ch in enumerate(text):
            d.text((w / 2, step * (i + 0.6)), ch, font=font, fill=(23, 18, 14, 255), anchor="mm")
    else:
        rng = random.Random(11)
        for i in range(5):
            y = h * (i + 0.5) / 5
            d.line([(w * 0.25, y + rng.uniform(-9, 9)), (w * 0.75, y + rng.uniform(-9, 9))],
                   fill=(23, 18, 14, 255), width=int(w * 0.1))
    return img


for i in range(3):
    brush_stroke(1024, 224, seed=10 + i).save(OUT / f"stroke-{i + 1}.png")
maple_leaf(128, seed=5).save(OUT / "leaf-1.png")
calligraphy(220, 1100).save(OUT / "calligraphy.png")
for i in range(3):
    brush_stroke(2048, 640, seed=40 + i, taper=0.55).save(OUT / f"veil-{i + 1}.png")
print(f"wrote placeholder art to {OUT}")
