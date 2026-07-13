# Ink Brush Realism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rough, realistic sumi ink strokes for the lobby buttons and the lobby→duel transition, with the stroke visibly *drawn* (frame-sequence masks with a ragged brush-tip frontier) instead of clip-path/slide reveals.

**Architecture:** Assets carry the realism (alpha = ink density; generated black-on-white, converted luminance→alpha by a new `scripts/ink_masks.py`, which also emits 12 progressive paint frames per stroke/veil and a granulated "dry" variant per veil). Motion carries the gesture: `InkStrokeButton` and `InkTransition` animate a Motion value 0→1 and derive two crossfading mask layers from it. Everything stays DOM + Framer Motion + CSS `mask-image` — no WebGL.

**Tech Stack:** React 19 + `motion/react` (Framer Motion), CSS masks, Python 3 + Pillow + numpy (asset pipeline), vitest.

**Spec:** `docs/superpowers/specs/2026-07-13-ink-brush-realism-design.md`

## Global Constraints

- Arrow functions only — no `function` declarations/expressions (user global CLAUDE.md).
- All mask PNGs stay **white-on-transparent**; CSS masks read the alpha channel only.
- Canonical mask filenames are **overwritten in place** (`public/images/intro/stroke-{1..3}.png`, `veil-{1..3}.png`) — project CLAUDE.md contract.
- `scripts/ink_masks.py` must be **deterministic**: fixed seeds, two runs → byte-identical files.
- Paint-on stays **state-driven on `visible`** (never delay-rescheduled) — the intro-skip contract; see the Framer Motion gotchas in project CLAUDE.md.
- Layout/timing constants live in `src/common/layout.ts` (`INTRO`), not scattered in components.
- Veil paint frames at **half resolution** (1024×320) — full-res frame stacks would cost ~120 MB decoded on mobile.
- `yarn lint`, `yarn build`, `yarn test` green at every commit.
- Working directory: repo root. Python deps (PIL 12, numpy 2) already installed; run scripts with `python3`.

---

### Task 1: Rough procedural placeholders (dev stand-ins worth looking at)

The current `brush_stroke()` stacks blurred ellipses — too soft to judge the new motion work. Make it genuinely rough (ragged contour, flying white, bristle speckle, splatter) so every later task is visually verifiable before the Nano Banana art lands.

**Files:**
- Modify: `scripts/make_intro_placeholders.py:18-40` (the `brush_stroke` function only)

**Interfaces:**
- Produces: same files as today — `public/images/intro/stroke-{1..3}.png` (1024×224), `veil-{1..3}.png` (2048×640), white-on-transparent RGBA. Task 2 consumes these as fallback input.

- [ ] **Step 1: Replace `brush_stroke` with the rough version**

Replace the whole `brush_stroke` function (lines 18–40) with:

```python
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
```

Nothing else in the file changes (leaf, calligraphy, the output loop at the bottom).

- [ ] **Step 2: Regenerate the placeholders**

Run: `python3 scripts/make_intro_placeholders.py`
Expected output: `wrote placeholder art to .../public/images/intro`

- [ ] **Step 3: Visually sanity-check one stroke**

Run: `python3 -c "from PIL import Image; im = Image.open('public/images/intro/stroke-1.png'); a = im.getchannel('A'); print(im.size, 'alpha histogram buckets>0:', sum(1 for v in a.histogram() if v))"`
Expected: `(1024, 224)` and a spread of many non-zero histogram buckets (varied alpha = ink density, not a binary blob). Open the PNG if running interactively — contour must look ragged, with white gaps inside the body.

- [ ] **Step 4: Commit**

```bash
git add scripts/make_intro_placeholders.py public/images/intro
git commit -m "feat: rough dry-brush procedural placeholders (ragged contour, flying white, splatter)"
```

---

### Task 2: `scripts/ink_masks.py` — masks, paint frames, dry variants

**Files:**
- Create: `scripts/ink_masks.py`
- Output (generated, committed): `public/images/intro/stroke-{1..3}.png`, `veil-{1..3}.png` (overwritten), `public/images/intro/frames/{stroke,veil}-N-f{01..12}.png`, `public/images/intro/veil-{1..3}-dry.png`

**Interfaces:**
- Consumes: `public/images/intro/src/<name>.{png,jpg,jpeg}` (real art, black ink on white paper) if present, else `public/images/intro/<name>.png` (Task 1 placeholders) as fallback.
- Produces: frame files named exactly `<name>-fNN.png` (NN = 01…12, 1-based, zero-padded) under `public/images/intro/frames/` — Task 3's `inkFrameSrc` builds these paths; `veil-N-dry.png` — Task 5 consumes.

- [ ] **Step 1: Write the script**

Create `scripts/ink_masks.py`:

```python
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
```

- [ ] **Step 2: Run it (fallback mode — no `src/` yet)**

Run: `python3 scripts/ink_masks.py`
Expected: the printed summary line; then verify the inventory:

Run: `ls public/images/intro/frames | wc -l && ls public/images/intro/*-dry.png`
Expected: `72` (6 assets × 12 frames) and the three `veil-{1,2,3}-dry.png` files.

- [ ] **Step 3: Verify frame semantics**

Run:
```bash
python3 - <<'EOF'
import numpy as np
from PIL import Image
f01 = np.asarray(Image.open("public/images/intro/frames/stroke-1-f01.png"))[..., 3].astype(int)
f06 = np.asarray(Image.open("public/images/intro/frames/stroke-1-f06.png"))[..., 3].astype(int)
f12 = np.asarray(Image.open("public/images/intro/frames/stroke-1-f12.png"))[..., 3].astype(int)
full = np.asarray(Image.open("public/images/intro/stroke-1.png"))[..., 3].astype(int)
assert f01.sum() < f06.sum() < f12.sum(), "frames must reveal progressively"
assert (f06 <= f12 + 1).all(), "frames must be monotonic"
assert abs(f12.sum() - full.sum()) / full.sum() < 0.01, "last frame ~= full mask"
half = np.asarray(Image.open("public/images/intro/frames/veil-1-f12.png"))
assert half.shape[:2] == (320, 1024), f"veil frames half-res, got {half.shape}"
print("frame semantics OK")
EOF
```
Expected: `frame semantics OK`

- [ ] **Step 4: Verify determinism**

Run:
```bash
shasum public/images/intro/frames/*.png public/images/intro/*-dry.png > /tmp/ink_masks_run1.sha \
  && python3 scripts/ink_masks.py \
  && shasum -c /tmp/ink_masks_run1.sha --quiet && echo DETERMINISTIC
```
Expected: `DETERMINISTIC`

- [ ] **Step 5: Commit**

```bash
git add scripts/ink_masks.py public/images/intro
git commit -m "feat: ink_masks.py pipeline — luminance->alpha masks, 12 paint frames, dry veil variants"
```

---

### Task 3: `inkFrames.ts` — pure frame math + paths (TDD)

**Files:**
- Create: `src/common/inkFrames.ts`
- Test: `src/common/inkFrames.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 4 and 5):
  - `interface InkFrameBlend { a: number; b: number; blend: number }` — `a` = 0-based index of the fully-shown frame, `b` = incoming frame (`=== a` on the last frame), `blend` = opacity of `b` in [0,1).
  - `inkFrameBlend(progress: number, frameCount: number): InkFrameBlend`
  - `inkFrameSrc(name: string, frame: number): string` — 0-based frame → `/images/intro/frames/<name>-fNN.png` (NN 1-based, zero-padded — Task 2's naming).
  - `preloadInkFrames(name: string, frameCount: number): void` — warms every frame via `new Image()`; no-op outside the browser.

- [ ] **Step 1: Write the failing test**

Create `src/common/inkFrames.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { inkFrameBlend, inkFrameSrc } from "./inkFrames";

describe("inkFrameBlend", () => {
	it("starts on the first frame", () => {
		expect(inkFrameBlend(0, 12)).toEqual({ a: 0, b: 1, blend: 0 });
	});

	it("ends exactly on the last frame with no incoming blend", () => {
		expect(inkFrameBlend(1, 12)).toEqual({ a: 11, b: 11, blend: 0 });
	});

	it("blends adjacent frames mid-way", () => {
		const { a, b, blend } = inkFrameBlend(0.5, 12);
		expect(a).toBe(5);
		expect(b).toBe(6);
		expect(blend).toBeCloseTo(0.5);
	});

	it("clamps out-of-range progress", () => {
		expect(inkFrameBlend(-0.5, 12).a).toBe(0);
		expect(inkFrameBlend(1.5, 12)).toEqual({ a: 11, b: 11, blend: 0 });
	});
});

describe("inkFrameSrc", () => {
	it("builds zero-padded 1-based frame paths from 0-based indices", () => {
		expect(inkFrameSrc("stroke-1", 0)).toBe("/images/intro/frames/stroke-1-f01.png");
		expect(inkFrameSrc("veil-3", 11)).toBe("/images/intro/frames/veil-3-f12.png");
	});
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `yarn vitest run src/common/inkFrames.test.ts`
Expected: FAIL — cannot resolve `./inkFrames`.

- [ ] **Step 3: Implement**

Create `src/common/inkFrames.ts`:

```ts
/** Frame math for the ink paint-on: which two mask frames to stack and how to blend them.
 *  Frames are monotonic (frame b contains frame a), so fading b in over a only ever ADDS
 *  the newly-painted delta — 12 steps read as one continuous stroke. */
export interface InkFrameBlend {
	/** 0-based index of the fully-shown frame. */
	a: number;
	/** Index of the incoming frame (=== a on the last frame). */
	b: number;
	/** Opacity of frame b, in [0, 1). */
	blend: number;
}

export const inkFrameBlend = (progress: number, frameCount: number): InkFrameBlend => {
	const p = Math.min(1, Math.max(0, progress)) * (frameCount - 1);
	const a = Math.floor(p);
	return { a, b: Math.min(a + 1, frameCount - 1), blend: p - a };
};

/** 0-based frame index -> the file emitted by scripts/ink_masks.py (1-based, zero-padded). */
export const inkFrameSrc = (name: string, frame: number): string =>
	`/images/intro/frames/${name}-f${String(frame + 1).padStart(2, "0")}.png`;

/** Warm every frame of a stroke once — the first paint-on must never flash a blank mask. */
export const preloadInkFrames = (name: string, frameCount: number): void => {
	if (typeof window === "undefined") return;
	for (let f = 0; f < frameCount; f++) new Image().src = inkFrameSrc(name, f);
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run src/common/inkFrames.test.ts`
Expected: PASS (5 tests). Then `yarn lint` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/common/inkFrames.ts src/common/inkFrames.test.ts
git commit -m "feat: inkFrames — pure frame-blend math + frame paths + preload for the ink paint-on"
```

---

### Task 4: `InkStrokeButton` — the stroke is drawn (frame sequence + crossfade)

**Files:**
- Modify: `src/common/layout.ts` (add three constants to `INTRO`, lines ~309-327)
- Modify: `src/common/components/atoms/InkStrokeButton/InkStrokeButton.tsx` (full rewrite below)

**Interfaces:**
- Consumes: `inkFrameBlend`, `inkFrameSrc`, `preloadInkFrames` from Task 3; frame files from Task 2; `INTRO.paintFrames` / `INTRO.strokePaint` added here.
- Produces: `InkStrokeButtonProps` UNCHANGED (`children,onClick?,disabled?,tone?,variant?,seal?,visible?,style?` — callers `Menu.tsx`, `Lobby.tsx`, `MultiplayerLobby.tsx` are not touched). `INTRO.paintFrames: 12`, `INTRO.strokePaint: 0.55`, `INTRO.veilDrag: 10` (veilDrag consumed by Task 5).

- [ ] **Step 1: Add the constants to `INTRO` in `src/common/layout.ts`**

Inside the `INTRO` object, after the `veilDry` line, add:

```ts
	// Ink paint-on (frame-sequence masks from scripts/ink_masks.py).
	paintFrames: 12, // frames per stroke/veil — must match FRAME_COUNT in ink_masks.py
	strokePaint: 0.55, // one button stroke's draw duration
	veilDrag: 10, // vw of residual wrist-drag while a veil stroke is being drawn
```

- [ ] **Step 2: Rewrite `InkStrokeButton.tsx`**

Replace the whole file with:

```tsx
import { useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { INTRO } from "../../../layout";
import { inkFrameBlend, inkFrameSrc, preloadInkFrames } from "../../../inkFrames";

const VARIANTS = ["stroke-1", "stroke-2", "stroke-3"] as const;

// Tones are SOLID ink; "ghost" dims via the wrapper's opacity instead of an rgba fill — the
// paint-on stacks two mask layers, and a translucent fill would double-darken their overlap.
const TONES = {
	ink: { color: "#17120e", opacity: 1 },
	red: { color: "#b73225", opacity: 1 },
	blue: { color: "#2f6f86", opacity: 1 },
	ghost: { color: "#17120e", opacity: 0.34 },
} as const;

for (const name of VARIANTS) preloadInkFrames(name, INTRO.paintFrames);

export interface InkStrokeButtonProps {
	children: ReactNode;
	onClick?: () => void;
	disabled?: boolean;
	tone?: keyof typeof TONES;
	/** Which brush texture (rotated variants keep siblings from looking cloned). */
	variant?: 0 | 1 | 2;
	/** Vermilion hanko dot at the stroke's end — the primary action's mark. */
	seal?: boolean;
	/** False = still hidden (intro choreography); flipping to true draws the stroke NOW. */
	visible?: boolean;
	style?: CSSProperties;
}

const MASK_LAYER: CSSProperties = {
	position: "absolute",
	inset: 0,
	WebkitMaskSize: "100% 100%",
	maskSize: "100% 100%",
};

/**
 * A floating sumi brush stroke that IS the button — and it is DRAWN, not revealed: a Motion
 * value 0→1 scrubs through 12 progressive mask frames (ragged, semi-transparent brush-tip
 * frontier baked in by scripts/ink_masks.py). Two stacked mask layers crossfade between
 * adjacent frames, and since frames are monotonic the fade only ever adds the fresh delta —
 * the stroke lays down continuously, flying white included.
 *
 * The paint-on stays STATE-driven (`visible`), never delay-scheduled: flipping `visible`
 * (re)starts the progress tween immediately, so an intro skip that flips every beat at once
 * fast-forwards reliably (a changed `transition.delay` would never restart a pending Motion
 * animation). Label/seal keep the variant choreography keyed off the same `visible`.
 */
export const InkStrokeButton = ({ children, onClick, disabled, tone = "ink", variant = 0, seal = false, visible = true, style }: InkStrokeButtonProps) => {
	const progress = useMotionValue(0);
	useEffect(() => {
		if (!visible) {
			progress.set(0);
			return;
		}
		const ctrl = animate(progress, 1, { duration: INTRO.strokePaint, ease: [0.22, 1, 0.36, 1] });
		return () => ctrl.stop();
	}, [visible, progress]);

	const name = VARIANTS[variant];
	const maskA = useTransform(progress, (v) => `url(${inkFrameSrc(name, inkFrameBlend(v, INTRO.paintFrames).a)})`);
	const maskB = useTransform(progress, (v) => `url(${inkFrameSrc(name, inkFrameBlend(v, INTRO.paintFrames).b)})`);
	const blend = useTransform(progress, (v) => inkFrameBlend(v, INTRO.paintFrames).blend);

	return (
		<motion.button
			type="button"
			disabled={disabled}
			onClick={onClick}
			initial="hidden"
			animate={visible ? "painted" : "hidden"}
			whileHover={disabled ? undefined : "bleed"}
			whileTap={disabled ? undefined : { scale: 0.97 }}
			style={{
				position: "relative",
				width: "100%",
				height: 70,
				padding: 0,
				background: "none",
				border: "none",
				cursor: disabled ? "default" : "pointer",
				...style,
				opacity: disabled ? 0.4 : 1,
			}}
		>
			{/* Stroke group: opacity gates the un-drawn state (frame f01 is never empty) and
			    carries the ghost tone; the drop-shadow shades the composed group once. */}
			<motion.span
				variants={{
					hidden: { opacity: 0 },
					painted: { opacity: TONES[tone].opacity, transition: { duration: 0.1 } },
					bleed: { opacity: TONES[tone].opacity, scaleX: 1.04, scaleY: 1.08, transition: { duration: 0.25 } },
				}}
				style={{ position: "absolute", inset: 0, filter: "drop-shadow(0 6px 12px rgba(0, 0, 0, 0.35))" }}
			>
				<motion.span style={{ ...MASK_LAYER, background: TONES[tone].color, WebkitMaskImage: maskA, maskImage: maskA }} />
				<motion.span style={{ ...MASK_LAYER, background: TONES[tone].color, opacity: blend, WebkitMaskImage: maskB, maskImage: maskB }} />
			</motion.span>
			<motion.span
				variants={{
					hidden: { opacity: 0 },
					painted: { opacity: 1, letterSpacing: "3px", transition: { delay: 0.15, duration: 0.35 } },
					bleed: { opacity: 1, letterSpacing: "4.5px", transition: { duration: 0.25 } },
				}}
				style={{
					position: "relative",
					color: "#f2ead9",
					fontSize: 16,
					fontWeight: 700,
					letterSpacing: 3,
					whiteSpace: "nowrap",
				}}
			>
				{children}
			</motion.span>
			{seal && (
				<motion.span
					variants={{
						hidden: { opacity: 0, scale: 0.4, rotate: -6 },
						painted: { opacity: 1, scale: 1, rotate: -6, transition: { delay: 0.3, duration: 0.3 } },
					}}
					style={{
						position: "absolute",
						// ON the stroke's tapering tail, not past the button box — the mask ends before the
						// box edge, so a negative offset reads as an orphaned floating square.
						right: 26,
						top: "50%",
						width: 18,
						height: 18,
						marginTop: -9,
						background: "#b73225",
						borderRadius: 4,
						boxShadow: "0 2px 6px rgba(0, 0, 0, 0.3)",
					}}
				/>
			)}
		</motion.button>
	);
};
```

- [ ] **Step 3: Lint + build + tests**

Run: `yarn lint && yarn build && yarn test`
Expected: all green. (Watch for react-hooks 7: the effect only touches the stable MotionValue — allowed.)

- [ ] **Step 4: Visual check in the dev server**

Run `yarn dev`, open the app:
1. Lobby intro: the two menu strokes must *draw themselves* left→right with a ragged frontier (not a straight wipe), staggered on their beats.
2. Tap during the intro (skip): all strokes fast-forward and draw immediately.
3. Hover: bleed (slight swell) still works; ghost-tone buttons (MULTIPLAYER → INDIETRO) draw at reduced opacity without darker double-painted patches.

- [ ] **Step 5: Commit**

```bash
git add src/common/layout.ts src/common/components/atoms/InkStrokeButton/InkStrokeButton.tsx
git commit -m "feat: InkStrokeButton strokes are drawn — 12-frame mask sequence with crossfade"
```

---

### Task 5: `InkTransition` — veils drawn onto the screen, then dried out

**Files:**
- Modify: `src/common/components/sections/InkTransition/InkTransition.tsx` (full rewrite below)

**Interfaces:**
- Consumes: `inkFrameBlend`, `inkFrameSrc`, `preloadInkFrames` (Task 3); `INTRO.paintFrames`, `INTRO.veilDrag` (Task 4); half-res veil frames + `veil-N-dry.png` (Task 2).
- Produces: `InkTransitionProps` UNCHANGED (`covering`, `release`, `onCovered` — `AppRoot.tsx` is not touched). `onCovered` timing contract unchanged (seal layer, same delay formula).

- [ ] **Step 1: Rewrite `InkTransition.tsx`**

Replace the whole file with:

```tsx
import { useEffect } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react";
import { INTRO } from "../../../layout";
import { inkFrameBlend, inkFrameSrc, preloadInkFrames } from "../../../inkFrames";

// Four sweeps cover the screen with overlap; a fifth solid layer seals any mask gaps.
// `flip` mirrors the whole stroke: frames are baked left→right, so -1 draws right→left.
const STROKES = [
	{ top: "-6%", height: "34vh", rotate: -7, flip: 1, veil: "veil-1" },
	{ top: "20%", height: "36vh", rotate: 5, flip: -1, veil: "veil-2" },
	{ top: "46%", height: "36vh", rotate: -4, flip: 1, veil: "veil-3" },
	{ top: "72%", height: "38vh", rotate: 8, flip: -1, veil: "veil-1" },
] as const;

for (const name of ["veil-1", "veil-2", "veil-3"]) {
	preloadInkFrames(name, INTRO.paintFrames);
	if (typeof window !== "undefined") new Image().src = `/images/intro/${name}-dry.png`;
}

const MASK_LAYER: CSSProperties = {
	position: "absolute",
	inset: 0,
	background: "#17120e",
	WebkitMaskSize: "100% 100%",
	maskSize: "100% 100%",
};

interface VeilStrokeProps {
	def: (typeof STROKES)[number];
	index: number;
	release: boolean;
}

/**
 * One sweep: a Motion value scrubs the 12 paint frames (two stacked mask layers crossfading,
 * as in InkStrokeButton) while a residual x-drag keeps the wrist moving — drawn by a gesture,
 * not stamped. On release the wet ink thins to its granulated `-dry` skeleton (pre-baked
 * variant, no runtime SVG filters), then the whole stroke brightens and fades.
 */
const VeilStroke = ({ def, index, release }: VeilStrokeProps) => {
	const progress = useMotionValue(0);
	useEffect(() => {
		const ctrl = animate(progress, 1, {
			duration: INTRO.veilCover,
			delay: index * INTRO.veilStrokeStagger,
			ease: [0.3, 0, 0.2, 1],
		});
		return () => ctrl.stop();
	}, [progress, index]);

	const maskA = useTransform(progress, (v) => `url(${inkFrameSrc(def.veil, inkFrameBlend(v, INTRO.paintFrames).a)})`);
	const maskB = useTransform(progress, (v) => `url(${inkFrameSrc(def.veil, inkFrameBlend(v, INTRO.paintFrames).b)})`);
	const blend = useTransform(progress, (v) => inkFrameBlend(v, INTRO.paintFrames).blend);
	// Frame f01 is not empty — keep the stroke invisible until its delayed tween actually starts.
	const started = useTransform(progress, (v) => (v > 0 ? 1 : 0));
	const x = useTransform(progress, (v) => `${(1 - v) * -INTRO.veilDrag}vw`);
	const dry = `url(/images/intro/${def.veil}-dry.png)`;

	return (
		<motion.div
			animate={release ? { opacity: 0, filter: "brightness(1.6) contrast(1.5)" } : { opacity: 1, filter: "brightness(1) contrast(1)" }}
			transition={release ? { duration: INTRO.veilDry, delay: index * INTRO.veilStrokeStagger, ease: "easeIn" } : { duration: 0 }}
			style={{
				position: "absolute",
				left: "-15vw",
				top: def.top,
				width: "130vw",
				height: def.height,
				rotate: def.rotate,
				scaleX: def.flip,
				x,
			}}
		>
			<motion.span style={{ position: "absolute", inset: 0, opacity: started }}>
				{/* Wet stroke: fades to its dry skeleton on release (the drying is the delta). */}
				<motion.span
					animate={release ? { opacity: 0 } : { opacity: 1 }}
					transition={release ? { duration: INTRO.veilDry * 0.4, delay: index * INTRO.veilStrokeStagger } : { duration: 0 }}
					style={{ position: "absolute", inset: 0 }}
				>
					<motion.span style={{ ...MASK_LAYER, WebkitMaskImage: maskA, maskImage: maskA }} />
					<motion.span style={{ ...MASK_LAYER, opacity: blend, WebkitMaskImage: maskB, maskImage: maskB }} />
				</motion.span>
				<motion.span
					animate={release ? { opacity: 1 } : { opacity: 0 }}
					transition={release ? { duration: INTRO.veilDry * 0.4, delay: index * INTRO.veilStrokeStagger } : { duration: 0 }}
					style={{ ...MASK_LAYER, WebkitMaskImage: dry, maskImage: dry }}
				/>
			</motion.span>
		</motion.div>
	);
};

export interface InkTransitionProps {
	/** True while the app wants the screen covered (game starting). */
	covering: boolean;
	/** True once the far side is ready — lets the ink dry out and reveal it. */
	release: boolean;
	onCovered: () => void;
}

/**
 * The lobby→duel veil: sumi strokes are DRAWN onto the screen one after another until it is
 * fully inked (→ `onCovered`, the canvases swap underneath), hold, then — once `release` —
 * each stroke dries to a granulated skeleton and fades, unveiling the new scene in motion.
 */
export const InkTransition = ({ covering, release, onCovered }: InkTransitionProps) => (
	<AnimatePresence>
		{covering && (
			<motion.div
				key="veil"
				// While covering the old screen must not accept clicks; once drying (release), the new scene is live.
				style={{ position: "fixed", inset: 0, zIndex: 4000, pointerEvents: release ? "none" : "auto", overflow: "hidden" }}
				exit={{ opacity: 0 }}
			>
				{STROKES.map((s, i) => (
					<VeilStroke key={i} def={s} index={i} release={release} />
				))}
				{/* Seal: closes the ragged gaps between strokes right as the last sweep lands. */}
				<motion.div
					initial={{ opacity: 0 }}
					animate={release ? { opacity: 0 } : { opacity: 1 }}
					transition={
						release
							? { duration: INTRO.veilDry * 0.6 }
							: { duration: 0.18, delay: STROKES.length * INTRO.veilStrokeStagger + INTRO.veilCover * 0.7 }
					}
					onAnimationComplete={() => {
						if (!release) onCovered();
					}}
					style={{ position: "absolute", inset: 0, background: "#17120e" }}
				/>
			</motion.div>
		)}
	</AnimatePresence>
);
```

- [ ] **Step 2: Lint + build + tests**

Run: `yarn lint && yarn build && yarn test`
Expected: all green.

- [ ] **Step 3: Visual check in the dev server**

Run `yarn dev`:
1. PASSA E GIOCA → four sweeps are *drawn* across the screen (alternating directions, slight residual drag), no stroke visible before its beat, full cover with no gaps (seal layer), then hold.
2. When the duel scene is ready: each stroke visibly granulates (dry skeleton shows through) while brightening/fading, unveiling the fly-in already in motion.
3. Narrow the window to a phone-ish width and repeat — timing and coverage must hold.

- [ ] **Step 4: Commit**

```bash
git add src/common/components/sections/InkTransition/InkTransition.tsx
git commit -m "feat: InkTransition veils are drawn on screen and dry out via pre-baked granulated variants"
```

---

### Task 6: Nano Banana prompt sheet + docs + final verification

**Files:**
- Create: `docs/art/ink-brush-prompts.md`
- Modify: `CLAUDE.md` (the "Lobby/intro placeholder art" gotcha bullet)

**Interfaces:**
- Consumes: everything above (documents the pipeline end-to-end).
- Produces: the instructions Emanuel follows to land the real art with zero code changes.

- [ ] **Step 1: Write the prompt sheet**

Create `docs/art/ink-brush-prompts.md`:

```markdown
# Nano Banana prompts — sumi ink strokes (lobby buttons + transition veils)

Generate each image as **black sumi ink on plain white paper** (NOT green-field, NOT
transparent, NOT checkerboard): the pipeline converts luminance → alpha, so diluted-ink
greys become real semi-transparency (flying white, dry-brush streaks survive intact).

Workflow:
1. Generate with the prompts below (any size ≥ the target; the script resizes).
2. Save as `public/images/intro/src/<name>.png` (or .jpg) — names: `stroke-1..3`, `veil-1..3`.
3. Run `python3 scripts/ink_masks.py` — it overwrites the canonical masks, regenerates the
   12 paint frames per asset and the `-dry` veil variants. No code changes needed.
4. Check in the dev server (`yarn dev`): lobby paint-on + PASSA E GIOCA transition.

## Button strokes (`stroke-1`, `stroke-2`, `stroke-3`) — target 1024×224

> A single horizontal sumi-e brush stroke, black Japanese calligraphy ink on plain white
> paper, landscape format. One confident dry-brush swipe from left to right: heavy wet ink
> at the left, raggedly tapering tail to the RIGHT with flying-white gaps where dry bristles
> split, a few small splatter flecks. Rough bristle-textured edges, uneven ink density,
> visible dilution greys. No other objects, no text, no border, nothing but the one stroke
> centered on white.

Vary per file: `stroke-1` fuller/wetter; `stroke-2` drier, more flying white; `stroke-3`
thinner and slightly arched. The tail MUST taper rightward — the hanko seal sits on it.

## Transition veils (`veil-1`, `veil-2`, `veil-3`) — target 2048×640

> A very wide horizontal sumi-e ink swipe, black Japanese ink on plain white paper,
> panoramic format. A broad loaded-brush sweep covering most of the height: dense black
> core, ragged torn top and bottom edges with bristle streaks, dry-brush breakup and
> flying white near one end, some splatter. Uneven, organic, energetic. Nothing but the
> stroke on white paper.

Veils should be FULLER than button strokes (they must cover the screen when stacked with
overlap) — dense core, ragged only at the edges.
```

- [ ] **Step 2: Update the CLAUDE.md gotcha**

In `CLAUDE.md`, replace the bullet that begins `- **Lobby/intro placeholder art**:` with:

```markdown
- **Lobby/intro ink art pipeline**: stroke/veil PNGs under `public/images/intro/` are consumed as CSS `mask-image`s (opaque = visible, alpha = ink density) and are generated by `scripts/ink_masks.py` — which ALSO emits the 12 progressive paint frames per asset (`frames/<name>-fNN.png`, veils at half res) and the granulated `veil-N-dry.png` variants that `InkStrokeButton`/`InkTransition` scrub through (`src/common/inkFrames.ts` maps progress → frame pair + blend). Real art = black sumi ink on WHITE paper (prompts in `docs/art/ink-brush-prompts.md`), dropped into `public/images/intro/src/`, then re-run the script: luminance→alpha conversion, same filenames overwritten, no code changes. Do NOT hand-edit files in `frames/`. `calligraphy.png`/`leaf-1.png` are still procedural placeholders (`scripts/make_intro_placeholders.py`), which is also the frame-pipeline's fallback input when `src/` is empty. Keep `FRAME_COUNT` (script) and `INTRO.paintFrames` (layout.ts) in sync.
```

- [ ] **Step 3: Full verification suite**

Run: `yarn lint && yarn build && yarn test && python3 scripts/ink_masks.py && git status --short`
Expected: lint/build/test green; script reruns deterministically (git status shows NO modified files under `public/images/intro/` after the rerun).

- [ ] **Step 4: Final visual walkthrough**

`yarn dev`: full pass — intro paint-on, skip-tap fast-forward, hover bleed, ghost buttons, PASSA E GIOCA → drawn veils → dry-out reveal, at desktop and narrow width.

- [ ] **Step 5: Commit**

```bash
git add docs/art/ink-brush-prompts.md CLAUDE.md
git commit -m "docs: Nano Banana ink prompts + ink pipeline gotcha in CLAUDE.md"
```
