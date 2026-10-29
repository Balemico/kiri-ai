"""Key the title logo out of its full-resolution source (red brush stroke + white lettering on WHITE)
into public/images/logo/kiri-ai-logo.png — with no white halo on the washi paper.

Stroke — keyed by COVERAGE, not a colour threshold: on white the green channel is ~255 and the ink's
~14, so ink coverage a = (255 - G) / (255 - ink_G). Every pixel is written as the solid ink colour with
that alpha, so a soft edge fades to transparent instead of to white (the previous PNG kept the white
mixed into its edge pixels: a pale rim on the cream paper).

Lettering — white too, so it is told apart from the white field by SHAPE, on the source alone:
1. The stroke mask is CLOSED (CLOSE) so the dry-brush gaps along its edge stop connecting a glyph's
   white to the outside, then its holes are filled: "inside" white.
2. An opening (OPEN) drops thin white (bristle gaps); each remaining blob is measured by ENCLOSURE —
   the share of its surrounding ring that is ink. Glyphs sit in the stroke (>= GLYPH_ENCLOSED, all
   ~0.9+); white between ragged brush streaks is open to the paper (<= ~0.75).
3. A big blob below that bar is a glyph fused with brush streaks (the final l and the white under it):
   only its part that survives a VERTICAL line opening is kept — the stems are tall, the streaks flat.
4. Glyphs are made opaque (ink mixed over white by coverage, i.e. exactly the source's look); every
   other white stays transparent, so the paper shows through the dry brush.

Usage: uv run --with pillow --with numpy --with scipy python -I scripts/key_logo.py [src] [out]
"""

import sys

import numpy as np
from PIL import Image
from scipy import ndimage

SRC = sys.argv[1] if len(sys.argv) > 1 else "art-src/logo-title-2k.jpeg"
OUT = sys.argv[2] if len(sys.argv) > 2 else "public/images/logo/kiri-ai-logo.png"
OUT_WIDTH = 1400  # px — the column shows it at ≤ 460 CSS px: ~3x on retina
PAD = 12  # px around the stroke's bounding box (source px)
CLOSE = 30  # px — closing radius that seals the stroke's ragged edge around the glyphs
OPEN = 6  # px — opening radius: thinner white than this is a bristle gap, not a glyph
DOT_MIN = 500  # px² — smallest glyph piece (the colon's dots are ~700)
GLYPH_ENCLOSED = 0.85  # ring-ink share above which a blob is a glyph
FUSED_MIN = 5000  # px² — a big, less enclosed blob = glyph fused with streaks → stem extraction
STEM = 45  # px — vertical line length that a stem survives and a flat streak does not
STEM_HEIGHT = 0.4  # a kept stem spans at least this share of the logo's height

src = np.asarray(Image.open(SRC).convert("RGB")).astype(np.float64)
g = src[..., 1]

# Ink colour = median of clearly inked pixels; coverage from the green channel against white.
ink = np.median(src[g < 60], axis=0)
cov = np.clip((255.0 - g) / (255.0 - ink[1]), 0.0, 1.0)
cov[cov < 0.04] = 0.0  # JPEG noise on the white field

# Crop to the stroke.
ys, xs = np.nonzero(cov > 0.3)
y0, y1 = max(ys.min() - PAD, 0), min(ys.max() + PAD, src.shape[0])
x0, x1 = max(xs.min() - PAD, 0), min(xs.max() + PAD, src.shape[1])
cov, g = cov[y0:y1, x0:x1], g[y0:y1, x0:x1]
stroke = cov > 0.5
white = g > 170


def disk(r: int) -> np.ndarray:
    return np.hypot(*np.mgrid[-r:r + 1, -r:r + 1]) <= r


# 1. White enclosed by the (sealed) stroke.
inside = ndimage.binary_fill_holes(ndimage.binary_closing(stroke, structure=disk(CLOSE))) & white
# 2. Thick blobs + their enclosure.
opened = ndimage.binary_opening(inside, structure=disk(OPEN))
labels, n = ndimage.label(opened)
ids = np.arange(1, n + 1)
sizes = ndimage.sum(np.ones_like(cov), labels, ids)
ring = ndimage.binary_dilation(opened, iterations=4) & ~ndimage.binary_dilation(opened, iterations=1)
ring_labels = ndimage.grey_dilation(labels, size=(11, 11)) * ring
enclosure = ndimage.mean(stroke.astype(np.float64), ring_labels, ids)

seeds = np.isin(labels, ids[(sizes >= DOT_MIN) & (enclosure >= GLYPH_ENCLOSED)])
# 3. Fused glyph + streaks: keep the tall stem only.
fused = np.isin(labels, ids[(sizes >= FUSED_MIN) & (enclosure < GLYPH_ENCLOSED)])
if fused.any():
    stem = ndimage.binary_opening(fused, structure=np.ones((STEM, 1), dtype=bool))
    # Only a real stem is TALL (the l spans most of the stroke); short blocks left of the streaks go.
    stem_labels, stem_n = ndimage.label(stem)
    for i, box in enumerate(ndimage.find_objects(stem_labels), start=1):
        if box[0].stop - box[0].start >= STEM_HEIGHT * cov.shape[0]:
            seeds |= stem_labels == i
# Back to each glyph's real high-res outline: regrow the seeds through the source's white, within a
# few px (the opening rounded the sharp tips; this restores them without re-flooding into gaps).
glyphs = ndimage.binary_dilation(seeds, iterations=OPEN + 2) & inside
glyphs = ndimage.binary_propagation(seeds, mask=glyphs)
# Anti-aliased rim: red→white across the glyph edge, not red→transparent.
glyph_zone = ndimage.binary_dilation(glyphs, iterations=2)

# 4. Compose.
h, w = cov.shape
rgba = np.zeros((h, w, 4))
rgba[..., :3] = ink
rgba[..., 3] = cov
mix = cov[glyph_zone][:, None]
rgba[glyph_zone, :3] = mix * ink + (1 - mix) * 255.0
rgba[glyph_zone, 3] = 1.0

img = Image.fromarray(np.dstack([rgba[..., :3], rgba[..., 3:] * 255]).clip(0, 255).astype(np.uint8), "RGBA")
img = img.resize((OUT_WIDTH, round(h * OUT_WIDTH / w)), Image.LANCZOS)
img.save(OUT, optimize=True)
kept = int(((sizes >= DOT_MIN) & (enclosure >= GLYPH_ENCLOSED)).sum())
print(f"ink={ink.round()} crop={x1 - x0}x{y1 - y0} glyph blobs={kept} fused={int(fused.any())} -> {OUT} {img.size}")
