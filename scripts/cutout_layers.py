"""Green-screen keying for the background parallax layers.

The layers were regenerated on a solid green background (#00FF00), so a proper chroma
key works cleanly: greenness (G above the other channels) -> transparent; ink grey and
the orange sun -> opaque. Per layer we tune two things:
  - despill: how hard to pull green out of soft edges ('avg' = strong, for the sun's
    green-yellow bleed; 'max' = gentle, for ink).
  - smooth: alpha blur radius. Big for the misty mountains (dissolves the residual green
    checker in the semi-transparent fog), tiny for the crisp tree.
Outputs <name>.png into public/images/backgroud/cutout/.
"""

import os
import numpy as np
from PIL import Image, ImageFilter

SRC = "public/images/backgroud"
OUT = os.path.join(SRC, "cutout")
os.makedirs(OUT, exist_ok=True)

KEY_LO = 20.0  # greenness at/below this -> fully opaque content
KEY_HI = 85.0  # greenness at/above this -> fully transparent background
FLOOR = 0.06   # snap near-empty pixels to fully transparent

# (file, despill mode, alpha-smooth radius). 0-complete stays opaque as the base plane.
LAYERS = [
    ("1-sun.jpeg", "avg", 2.0),
    ("2-left-mountain.jpeg", "max", 16.0),
    ("3-right-mountain.jpeg", "max", 16.0),
    ("4-tree.jpeg", "max", 1.5),
]


def cutout(name, despill, smooth):
    im = Image.open(os.path.join(SRC, name)).convert("RGB")
    arr = np.asarray(im).astype(np.float32)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]

    # Greenness: how much green exceeds the brighter of red/blue.
    key = g - np.maximum(r, b)
    alpha = np.clip((KEY_HI - key) / (KEY_HI - KEY_LO), 0, 1)

    # Despill: cap green so edges aren't tinted. 'avg' also kills the sun's yellow-green.
    cap = (r + b) / 2 if despill == "avg" else np.maximum(r, b)
    rgb = np.dstack([r, np.minimum(g, cap), b])

    if smooth > 0:
        a_img = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(smooth))
        alpha = np.asarray(a_img).astype(np.float32) / 255
    alpha[alpha < FLOOR] = 0

    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    Image.fromarray(out, "RGBA").save(os.path.join(OUT, os.path.splitext(name)[0] + ".png"))
    return round(float((alpha > 0.5).mean()), 3)


for name, despill, smooth in LAYERS:
    opaque = cutout(name, despill, smooth)
    print(f"{name:24s} -> {os.path.splitext(name)[0] + '.png':22s}  opaque~{opaque:.3f}  (despill={despill}, smooth={smooth})")
print("done ->", OUT)
