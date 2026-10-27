#!/usr/bin/env python3
"""Ink mask pipeline: turns sumi stroke art into the CSS mask assets the lobby consumes.

Input per asset name (first match wins):
  1. public/images/intro/src/<name>.{png,jpg,jpeg} — REAL art: black ink on WHITE paper.
     Luminance -> alpha (paper transparent, solid ink opaque, dilution = semi-transparent).
  2. public/images/intro/<name>.png — fallback: the existing mask itself (alpha as-is),
     so the whole pipeline runs before the real art lands.

Output (white-on-transparent, CSS masks read alpha only):
  public/images/intro/<name>.png     — canonical full mask, overwritten in place
  public/images/intro/wipe-N.png     — paint-on wipe ramps: solid LEFT, ragged brush-tip
                                        frontier, transparent RIGHT. A fill layer masked by
                                        this slides under the (static) stroke mask, so the
                                        reveal frontier moves CONTINUOUSLY (no frame steps).
  public/images/intro/veil-N-dry.png — granulated dry variant (veils only)

Deterministic: fixed seeds; two runs produce byte-identical files.
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / "public" / "images" / "intro"
SRC = ROOT / "src"

SIZES = {"stroke": (1024, 224), "veil": (2048, 640)}  # canonical mask sizes
WIPE_SIZE = (1024, 320)  # ramps are soft — resolution matters little
# The wipe image is WIPE_SCALE x the reveal box (keep in sync with src/common/inkWipe.ts).
# The box sees ramp interval [(S-1)/S, 1] at travel start (must be fully transparent) and
# [0, 1/S] at travel end (must be fully solid) — so the whole ragged frontier must live
# inside (1/S, (S-1)/S). S=3 gives it the middle third: one full box-width of raggedness.
WIPE_SCALE = 3.0


def resize_alpha(alpha, w, h):
    img = Image.fromarray((np.clip(alpha, 0, 1) * 255).astype(np.uint8), "L")
    return np.asarray(img.resize((w, h), Image.LANCZOS), dtype=np.float32) / 255.0


def load_alpha(name):
    """Alpha map float32 [0,1] at the canonical size for this asset kind."""
    alpha = None
    for ext in ("png", "jpg", "jpeg"):
        p = SRC / f"{name}.{ext}"
        if p.exists():
            lum = np.asarray(Image.open(p).convert("L"), dtype=np.float32) / 255.0
            # Levels: near-white paper -> 0, solid ink -> 1, dilution greys in between.
            alpha = np.clip((0.92 - lum) / (0.92 - 0.10), 0.0, 1.0)
            alpha[alpha < 0.04] = 0.0
            break
    if alpha is None:
        im = Image.open(ROOT / f"{name}.png").convert("RGBA")
        alpha = np.asarray(im, dtype=np.float32)[..., 3] / 255.0
    w, h = SIZES[name.split("-")[0]]
    if alpha.shape != (h, w):
        alpha = resize_alpha(alpha, w, h)
    return alpha


def save_mask(alpha, path):
    h, w = alpha.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[..., :3] = 255
    rgba[..., 3] = (np.clip(alpha, 0, 1) * 255).astype(np.uint8)
    Image.fromarray(rgba, "RGBA").save(path)


def wipe_ramp(seed):
    """Solid-to-transparent ramp whose frontier is a ragged, bristled brush tip.
    The whole frontier (waver + feather + spikes) stays inside the middle third of the
    ramp, so the reveal box is fully bare at travel start and fully covered at the end."""
    w, h = WIPE_SIZE
    rng = np.random.RandomState(seed)

    def noise_col(cells, lo, hi):
        pts = rng.rand(cells)
        return np.interp(np.linspace(0, cells - 1, h), np.arange(cells), pts) * (hi - lo) + lo

    # Frontier x-position per row: layered waver, no straight lines anywhere.
    b = 0.47 + noise_col(6, -0.07, 0.07) + noise_col(22, -0.02, 0.02) + noise_col(90, -0.01, 0.01)
    xs = np.linspace(0.0, 1.0, w, dtype=np.float32)[None, :]
    # Watery soft edge…
    alpha = np.clip((b[:, None] - xs) / 0.05, 0.0, 1.0).astype(np.float32)
    # …with thin dry bristle spikes shooting ahead of the wet front.
    spike = np.clip(noise_col(150, -1.0, 1.0), 0, 1) ** 2 * 0.09
    tips = np.clip((b[:, None] + spike[:, None] - xs) / 0.008, 0.0, 1.0) * (spike[:, None] > 0.015) * 0.85
    return np.maximum(alpha, tips)


def dry_variant(alpha, seed):
    """Granulated skeleton: noise eats thin/translucent ink first, solid cores survive."""
    h, w = alpha.shape
    rng = np.random.RandomState(seed)
    grid = (rng.rand(24, 96) * 255).astype(np.uint8)
    noise = np.asarray(Image.fromarray(grid, "L").resize((w, h), Image.BILINEAR), dtype=np.float32) / 255.0
    keep = np.clip((alpha - (0.35 + (noise - 0.5) * 0.55)) / 0.08, 0.0, 1.0)
    return alpha * keep * 0.9


for i in (1, 2, 3):
    save_mask(load_alpha(f"stroke-{i}"), ROOT / f"stroke-{i}.png")
    save_mask(wipe_ramp(seed=400 + i), ROOT / f"wipe-{i}.png")

for i in (1, 2, 3):
    name = f"veil-{i}"
    alpha = load_alpha(name)
    save_mask(alpha, ROOT / f"{name}.png")
    save_mask(dry_variant(alpha, seed=300 + i), ROOT / f"{name}-dry.png")

print(f"wrote masks, wipe ramps and dry variants under {ROOT}")
