#!/usr/bin/env python3
"""Ink mask pipeline: turns sumi stroke art into the CSS mask assets the lobby consumes.

Input per asset name (first match wins):
  1. public/images/intro/src/<name>.{png,jpg,jpeg} — REAL art: black ink on WHITE paper.
     Luminance -> alpha (paper transparent, solid ink opaque, dilution = semi-transparent).
  2. public/images/intro/<name>.png — fallback: the existing mask itself (alpha as-is),
     so the whole pipeline runs before the real art lands.

Output (white-on-transparent, CSS masks read alpha only):
  public/images/intro/<name>.png            — canonical full mask, overwritten in place
  public/images/intro/frames/<name>-fNN.png — 12 progressive paint frames (veils half-res)
  public/images/intro/veil-N-dry.png        — granulated dry variant (veils only)

Deterministic: fixed seeds; two runs produce byte-identical files.
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / "public" / "images" / "intro"
SRC = ROOT / "src"
FRAMES = ROOT / "frames"
FRAMES.mkdir(parents=True, exist_ok=True)

FRAME_COUNT = 12
EDGE = 0.07    # soft width of the advancing frontier (fraction of stroke length)
JITTER = 0.22  # how far noise bends the frontier away from a straight vertical line
SIZES = {"stroke": (1024, 224), "veil": (2048, 640)}  # canonical mask sizes


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


def low_freq_noise(w, h, seed, cells=(5, 16)):
    rng = np.random.RandomState(seed)
    grid = (rng.rand(*cells) * 255).astype(np.uint8)
    img = Image.fromarray(grid, "L").resize((w, h), Image.BILINEAR)
    return np.asarray(img, dtype=np.float32) / 255.0


def paint_frames(alpha, seed):
    """FRAME_COUNT masks revealing alpha left->right behind a noisy soft frontier.
    Monotonic (frame k+1 contains frame k); the last frame is the full stroke."""
    h, w = alpha.shape
    xs = np.tile(np.linspace(0.0, 1.0, w, dtype=np.float32), (h, 1))
    field = xs + (low_freq_noise(w, h, seed) - 0.5) * JITTER
    t_full = field.max() + EDGE  # threshold at which everything is revealed
    return [alpha * np.clip((t_full * k / FRAME_COUNT - field) / EDGE, 0.0, 1.0)
            for k in range(1, FRAME_COUNT + 1)]


def dry_variant(alpha, seed):
    """Granulated skeleton: noise eats thin/translucent ink first, solid cores survive."""
    h, w = alpha.shape
    noise = low_freq_noise(w, h, seed, cells=(24, 96))
    keep = np.clip((alpha - (0.35 + (noise - 0.5) * 0.55)) / 0.08, 0.0, 1.0)
    return alpha * keep * 0.9


for i in (1, 2, 3):
    name = f"stroke-{i}"
    alpha = load_alpha(name)
    save_mask(alpha, ROOT / f"{name}.png")
    for k, fr in enumerate(paint_frames(alpha, seed=100 + i), start=1):
        save_mask(fr, FRAMES / f"{name}-f{k:02d}.png")

for i in (1, 2, 3):
    name = f"veil-{i}"
    alpha = load_alpha(name)
    save_mask(alpha, ROOT / f"{name}.png")
    half = resize_alpha(alpha, alpha.shape[1] // 2, alpha.shape[0] // 2)
    for k, fr in enumerate(paint_frames(half, seed=200 + i), start=1):
        save_mask(fr, FRAMES / f"{name}-f{k:02d}.png")
    save_mask(dry_variant(alpha, seed=300 + i), ROOT / f"{name}-dry.png")

print(f"wrote masks, {FRAME_COUNT} frames/asset and dry variants under {ROOT}")
