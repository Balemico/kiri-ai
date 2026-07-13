#!/usr/bin/env python3
"""Procedural placeholder art for the lobby intro (brush strokes, leaf, calligraphy, veil).

Placeholders only: real art comes from the Nano-Banana + cutout_layers.py pipeline and simply
overwrites these files. Strokes/veil/calligraphy are WHITE (or black) on TRANSPARENT — the
stroke/veil PNGs are consumed as CSS mask-images, so white = visible, transparent = cut.
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).resolve().parent.parent / "public" / "images" / "intro"
OUT.mkdir(parents=True, exist_ok=True)


def brush_stroke(w, h, seed, taper=0.75):
    """A dry, rough horizontal stroke: hard-noised body + flying-white streaks + bristle
    speckle at the contour + stray splatter. Alpha carries ink density (greys = dilution)."""
    rng = random.Random(seed)
    img = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(img)
    cy = h // 2
    # Body: jittered ellipses with hard radius noise — ragged contour, uneven ink load.
    for x in range(0, w, 3):
        t = x / w
        end = min(t, 1 - t) / (1 - taper) if taper < 1 else 1.0
        swell = 0.5 + 0.42 * math.sin(t * math.pi) + rng.uniform(-0.3, 0.3)
        r = max(1, int(h * 0.36 * swell * min(1.0, end * 3.2)))
        wob = int(math.sin(t * 7 + seed) * h * 0.06) + rng.randint(-4, 4)
        d.ellipse([x - r, cy - r + wob, x + r, cy + r + wob], fill=rng.randint(200, 255))
    # Flying white: long thin gaps where dry bristles left no ink.
    for _ in range(14):
        y0 = cy + rng.randint(-h // 3, h // 3)
        x0 = rng.randint(0, w // 2)
        x1 = x0 + rng.randint(w // 6, w // 2)
        d.line([(x0, y0), (x1, y0 + rng.randint(-6, 6))], fill=0, width=rng.randint(1, max(2, h // 40)))
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    # Bristle speckle: erode the contour into grain.
    px = img.load()
    for _ in range(w * h // 30):
        x, y = rng.randrange(w), rng.randrange(h)
        if 24 < px[x, y] < 235:
            d.ellipse([x - 2, y - 1, x + 2, y + 1], fill=0)
    # Stray splatter dots just outside the body (semi-transparent = diluted flicks).
    for _ in range(w // 18):
        x, y = rng.randrange(w), rng.randrange(h)
        if px[x, y] == 0 and rng.random() < 0.5:
            r = rng.randint(1, 3)
            d.ellipse([x - r, y - r, x + r, y + r], fill=rng.randint(140, 230))
    rgba = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    rgba.putalpha(img.point(lambda v: 0 if v < 24 else v))
    return rgba


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
