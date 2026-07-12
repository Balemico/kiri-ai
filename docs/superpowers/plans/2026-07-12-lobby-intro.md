# Immersive Lobby Intro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static lobby with an animated sumi-e panorama (falling maple leaves from a left-anchored tree, drifting mist), a right-fixed "floating ink strokes" menu, a skippable ~4.5 s entry cinematic, a multi-brushstroke ink veil on game start, and a bird-view fly-back reveal when the duel scene mounts.

**Architecture:** Hybrid (approach C of the spec `docs/superpowers/specs/2026-07-12-lobby-intro-design.md`): the lobby gets its own lightweight R3F canvas that reuses `ParallaxLayer`/`Floor`/existing stage art plus two new atoms (`FallingLeaves`, `Mist`); the menu stays DOM (Framer Motion). `AppRoot` keeps its session gate; the lobby→game swap happens under a DOM `InkTransition`; the game `Scene` gains a one-shot camera flight + staged mounting on entry. Only one canvas is ever active at a time.

**Tech Stack:** React 19, TypeScript, @react-three/fiber 9 + drei, gsap, motion (Framer Motion) 12, leva, vitest, Python 3 + Pillow (placeholder assets only).

## Global Constraints

- Arrow functions ONLY — never `function` declarations/expressions (user global CLAUDE.md).
- Indentation: TABS, double quotes (match every existing file).
- All new layout constants live in `src/common/layout.ts` in single well-named objects (`LOBBY`, `INTRO`); every Leva folder is named + `{ collapsed: true }` and reads its defaults from that object.
- Scenery materials are unlit: `meshBasicMaterial`, `toneMapped:false`, `depthWrite:false` where translucent.
- Materials created with `new THREE.*Material` and passed via `material={}`/`primitive` must be `dispose()`-d on unmount.
- No React StrictMode assumptions broken; all gsap tweens on remountable components use `overwrite: true` and are killed on cleanup.
- Molecules must not import from sections; net/components may import from `components/atoms`.
- UI copy is Italian (existing convention: "PASSA E GIOCA", "MULTIPLAYER", …).
- `yarn lint`, `yarn build`, `yarn test` must be green at every commit.
- Engine (`src/common/game/`) must NOT be touched.
- The camera flight must end exactly on the `cameraPose` FitCamera would apply (no visible jump at handoff).

---

### Task 1: Layout constants (`LOBBY`, `INTRO`) + pure `cameraPose` + FitCamera refactor

**Files:**
- Modify: `src/common/layout.ts` (append after the `STAGE_LAYERS` block, ~line 246)
- Create: `src/common/layout.test.ts`
- Modify: `src/common/components/atoms/FitCamera/FitCamera.tsx`

**Interfaces:**
- Consumes: existing `SceneFrame`, `STAGE_LAYERS`.
- Produces: `LOBBY` (lobby panorama + leaves + mist + DOM column knobs), `INTRO` (all cinematic/veil/flight timings), `CameraPose { y; z }`, `cameraPose(frame: SceneFrame, aspect: number, fovDeg: number): CameraPose`, and `FitCamera` prop `enabled?: boolean` (default `true`). Later tasks import all of these by name.

- [ ] **Step 1: Write the failing tests**

Create `src/common/layout.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cameraPose, DEFAULT_SCENE_FRAME, frameViewport, INTRO, LOBBY } from "./layout";

describe("cameraPose", () => {
	it("fits by height on wide viewports (same distance regardless of extra width)", () => {
		const wide = cameraPose(DEFAULT_SCENE_FRAME, 4, 30);
		const wider = cameraPose(DEFAULT_SCENE_FRAME, 8, 30);
		expect(wide.z).toBeCloseTo(wider.z, 6);
		// dist = halfHeight / tan(fov/2) = 1.6 / tan(15°)
		expect(wide.z).toBeCloseTo(1.6 / Math.tan((30 * Math.PI) / 360), 6);
	});
	it("dollies back on narrow viewports to keep halfWidth framed", () => {
		const narrow = cameraPose(DEFAULT_SCENE_FRAME, 0.8, 30);
		const expected = DEFAULT_SCENE_FRAME.halfWidth / (Math.tan((30 * Math.PI) / 360) * 0.8);
		expect(narrow.z).toBeCloseTo(expected, 6);
	});
	it("centres y between top and bottom", () => {
		expect(cameraPose(DEFAULT_SCENE_FRAME, 2, 30).y).toBeCloseTo((DEFAULT_SCENE_FRAME.top + DEFAULT_SCENE_FRAME.bottom) / 2, 6);
	});
	it("matches the visible rect frameViewport derives (same fit rule)", () => {
		// Whichever axis forces the camera back sets the visible half-height — both helpers must agree.
		const aspect = 0.9;
		const vp = frameViewport(DEFAULT_SCENE_FRAME, aspect);
		const pose = cameraPose(DEFAULT_SCENE_FRAME, aspect, 30);
		expect((vp.height / 2) / Math.tan((30 * Math.PI) / 360)).toBeCloseTo(pose.z, 6);
	});
});

describe("intro constants", () => {
	it("reveal beats fit inside the flight", () => {
		expect(INTRO.boardRevealAt).toBeLessThan(INTRO.flightDur);
		expect(INTRO.handRevealAt).toBeLessThan(INTRO.flightDur);
	});
	it("leaf emitter sits above the kill line", () => {
		expect(LOBBY.leaves.emitterY).toBeGreaterThan(LOBBY.leaves.floorY);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/common/layout.test.ts`
Expected: FAIL — `cameraPose`, `INTRO`, `LOBBY` are not exported.

- [ ] **Step 3: Implement in `layout.ts`**

Append after the `STAGE_LAYERS` array:

```ts
// --- Lobby panorama (menu backdrop) ---
// The lobby reuses the game's stage art but re-stages it: the maple tree is anchored to the LEFT
// edge, bigger and nearer, because its canopy is the SOURCE of the falling leaves (they detach
// from it and drift right across the scene — never spawn mid-air). Single source for the "Lobby"
// Leva folder.
export const LOBBY = {
	// Tree re-staging (offsets applied on top of the shared layer size/position).
	treeX: -2.1, // world-x shift left
	treeY: -0.1,
	treeScale: 1.45, // multiplier on the shared panel size
	// Leaf particle field. Every leaf is born inside the canopy-aligned emitter box and dies
	// below the visible bottom, then re-enters from the canopy (deterministic per-index cycle).
	leaves: {
		count: 36,
		reducedCount: 4, // prefers-reduced-motion / low-end fallback
		emitterX: -1.9, // canopy centre (world)
		emitterY: 1.25,
		emitterWidth: 1.5,
		emitterHeight: 0.7,
		floorY: -2.3, // below the frame bottom → leaves exit off-screen
		fallSpeed: 0.22, // world units/s, base
		fallJitter: 0.5, // ±50% per-leaf speed variance
		drift: 0.3, // steady rightward wind (units/s at gust 1)
		sway: 0.16, // lateral flutter amplitude
		swayFreq: 0.7, // flutter Hz
		spinSpeed: 1.1, // tumbling rad/s, base
		windFreq: 0.11, // global gust Hz (slow)
		windStrength: 0.6, // gust modulation of the drift (0 = constant wind)
		minScale: 0.05,
		maxScale: 0.1,
		backRatio: 0.25, // fraction rendered on the far plane (smaller/paler, behind the mist)
	},
	mist: {
		bands: 3,
		height: 0.55, // world height of one band
		opacity: 0.32,
		speed: 0.018, // horizontal drift, world units/s
		y: -0.05, // band-cluster centre relative to the horizon
	},
	columnWidthPct: 34, // landscape DOM menu column, % of viewport width
} as const;

// --- Intro choreography (entry cinematic, exit veil, fly-back reveal) ---
// All timings in seconds. Single source for the "Intro" Leva folder + the DOM delays.
export const INTRO = {
	// Entry: stage layers paint far → near, then sun/tree/mist/leaves, then the DOM menu.
	layerStagger: 0.28,
	layerFade: 0.9, // per-layer fade/rise duration
	leavesDelay: 1.8, // leaves become visible (storyboard beat 3)
	menuDelay: 2.5, // first DOM element (calligraphy) starts painting
	menuStagger: 0.35, // per-menu-item stagger after menuDelay
	// Exit veil: brush strokes cover one after another, then "dry" out in order.
	veilCover: 0.55, // one stroke's sweep duration
	veilStrokeStagger: 0.14,
	veilDry: 0.7, // one stroke's dry/fade-out duration
	// Fly-back reveal: bird view above the board pulling back to the FitCamera pose.
	flightDur: 2.5,
	flightStartHeight: 2.4, // start y above the final camera y
	flightStartDist: 0.35, // start z as a FRACTION of the final camera distance
	boardRevealAt: 0.5, // seconds into the flight: board line + pawns mount
	handRevealAt: 1.5, // seconds into the flight: hand fan cascades in
} as const;

/** Camera pose (y, z) of the locked front view for a frame + aspect — FitCamera's fit rule as a pure function. */
export interface CameraPose {
	y: number;
	z: number;
}

export const cameraPose = (frame: SceneFrame, aspect: number, fovDeg: number): CameraPose => {
	const halfHeight = (frame.top - frame.bottom) / 2;
	const centerY = (frame.top + frame.bottom) / 2;
	const tan = Math.tan((fovDeg * Math.PI) / 360); // tan(vFov/2)
	// Distance that fits the frame vertically vs horizontally — take the larger (no axis clipped).
	return { y: centerY, z: Math.max(halfHeight / tan, frame.halfWidth / (tan * aspect)) };
};
```

- [ ] **Step 4: Refactor `FitCamera` onto `cameraPose` + add `enabled`**

Replace the whole body of `FitCamera.tsx`:

```tsx
import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { cameraPose, DEFAULT_SCENE_FRAME, type SceneFrame } from "../../../layout";

export interface FitCameraProps {
	frame?: SceneFrame;
	/** False while a cinematic (IntroFlight) owns the camera — the fit is skipped, not fought. */
	enabled?: boolean;
}

/**
 * Locks the perspective camera to a single, fixed front view (no orbit / pan / zoom).
 * It dollies along z so the whole `frame` rectangle stays fully visible at any desktop
 * viewport width. The fit itself is `cameraPose` (pure, shared with IntroFlight so the
 * flight can land exactly on this pose).
 */
export const FitCamera = ({ frame = DEFAULT_SCENE_FRAME, enabled = true }: FitCameraProps) => {
	const camera = useThree((s) => s.camera);
	const size = useThree((s) => s.size);

	useLayoutEffect(() => {
		if (!enabled || !(camera instanceof THREE.PerspectiveCamera)) return;
		const pose = cameraPose(frame, size.width / size.height, camera.fov);
		camera.position.set(0, pose.y, pose.z);
		camera.lookAt(0, pose.y, 0);
		camera.updateProjectionMatrix();
	}, [camera, enabled, size.width, size.height, frame.top, frame.bottom, frame.halfWidth]);

	return null;
};
```

- [ ] **Step 5: Run tests + suite**

Run: `yarn vitest run src/common/layout.test.ts && yarn test && yarn lint && yarn build`
Expected: all PASS (FitCamera behaviour unchanged for `enabled=true`).

- [ ] **Step 6: Commit**

```bash
git add src/common/layout.ts src/common/layout.test.ts src/common/components/atoms/FitCamera/FitCamera.tsx
git commit -m "feat: add LOBBY/INTRO layout constants and pure cameraPose shared by FitCamera"
```

---

### Task 2: Pure leaf-field math (`leaves.ts`)

**Files:**
- Create: `src/common/leaves.ts`
- Create: `src/common/leaves.test.ts`

**Interfaces:**
- Consumes: `LOBBY` from `./layout` (only its `leaves` shape, as the `LeafFieldConfig` type).
- Produces:
  - `type LeafFieldConfig = typeof LOBBY.leaves`
  - `leafRandom(index: number, salt: number): number` — deterministic hash in [0, 1)
  - `interface LeafSpawn { x0: number; y0: number; speed: number; cycle: number; phase: number; scale: number; back: boolean }`
  - `leafSpawn(index: number, cfg: LeafFieldConfig): LeafSpawn`
  - `interface LeafPose { x: number; y: number; rotX: number; rotY: number; rotZ: number; scale: number; back: boolean }`
  - `leafPose(index: number, t: number, cfg: LeafFieldConfig): LeafPose`

- [ ] **Step 1: Write the failing tests**

Create `src/common/leaves.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LOBBY } from "./layout";
import { leafPose, leafRandom, leafSpawn } from "./leaves";

const cfg = LOBBY.leaves;

describe("leafRandom", () => {
	it("is deterministic and in [0,1)", () => {
		for (let i = 0; i < 50; i++) {
			const v = leafRandom(i, 3);
			expect(v).toBe(leafRandom(i, 3));
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});
	it("differs across salts", () => {
		expect(leafRandom(7, 1)).not.toBe(leafRandom(7, 2));
	});
});

describe("leafSpawn", () => {
	it("births every leaf inside the canopy emitter box", () => {
		for (let i = 0; i < cfg.count; i++) {
			const s = leafSpawn(i, cfg);
			expect(Math.abs(s.x0 - cfg.emitterX)).toBeLessThanOrEqual(cfg.emitterWidth / 2);
			expect(s.y0).toBeLessThanOrEqual(cfg.emitterY);
			expect(s.y0).toBeGreaterThanOrEqual(cfg.emitterY - cfg.emitterHeight);
		}
	});
	it("cycle spans the fall from the spawn point to the kill line", () => {
		const s = leafSpawn(3, cfg);
		expect(s.cycle).toBeCloseTo((s.y0 - cfg.floorY) / s.speed, 6);
	});
});

describe("leafPose", () => {
	it("always stays between the kill line and the emitter top", () => {
		for (let i = 0; i < cfg.count; i++) {
			for (const t of [0, 1.7, 12.3, 55.5, 240.1]) {
				const p = leafPose(i, t, cfg);
				expect(p.y).toBeGreaterThanOrEqual(cfg.floorY - 1e-6);
				expect(p.y).toBeLessThanOrEqual(cfg.emitterY + 1e-6);
			}
		}
	});
	it("falls monotonically within one cycle", () => {
		const s = leafSpawn(5, cfg);
		// Sample twice inside the same cycle (start of the cycle after phase alignment).
		const t0 = s.cycle - s.phase + 0.01; // localT ≈ 0
		const p0 = leafPose(5, t0, cfg);
		const p1 = leafPose(5, t0 + s.cycle * 0.3, cfg);
		expect(p1.y).toBeLessThan(p0.y);
	});
	it("re-enters from the canopy after a full cycle (x resets near the spawn column)", () => {
		const s = leafSpawn(9, cfg);
		const t0 = s.cycle - s.phase + 0.01;
		const born = leafPose(9, t0, cfg);
		const reborn = leafPose(9, t0 + s.cycle, cfg);
		expect(Math.abs(reborn.y - born.y)).toBeLessThan(0.05);
		expect(Math.abs(reborn.x - born.x)).toBeLessThan(cfg.sway * 2 + 0.05);
	});
	it("splits front/back deterministically by backRatio", () => {
		const backs = Array.from({ length: cfg.count }, (_, i) => leafPose(i, 0, cfg).back);
		expect(backs.filter(Boolean).length).toBeGreaterThan(0);
		expect(backs.filter(Boolean).length).toBeLessThan(cfg.count);
		expect(backs).toEqual(Array.from({ length: cfg.count }, (_, i) => leafPose(i, 99, cfg).back));
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/common/leaves.test.ts`
Expected: FAIL — module `./leaves` not found.

- [ ] **Step 3: Implement `src/common/leaves.ts`**

```ts
// Pure leaf-field math for the lobby's falling maple leaves — no React, no Three (unit-tested).
// Each leaf lives on a deterministic per-index cycle: born inside the tree-canopy emitter box,
// it falls with a per-leaf speed, drifts right on a gusting wind, flutters, tumbles, and once it
// crosses the kill line it re-enters from the canopy (same spawn column) — never mid-air.

import type { LOBBY } from "./layout";

export type LeafFieldConfig = typeof LOBBY.leaves;

const TWO_PI = Math.PI * 2;
const fract = (v: number): number => v - Math.floor(v);

/** Deterministic per-leaf hash in [0,1) — same idiom as the InkBrush shader's hash. */
export const leafRandom = (index: number, salt: number): number => fract(Math.abs(Math.sin(index * 127.1 + salt * 311.7)) * 43758.5453);

export interface LeafSpawn {
	x0: number;
	y0: number;
	speed: number;
	cycle: number;
	phase: number;
	scale: number;
	back: boolean;
}

/** Static per-leaf birth parameters (spawn point in the canopy, fall speed, cycle length, …). */
export const leafSpawn = (index: number, cfg: LeafFieldConfig): LeafSpawn => {
	const x0 = cfg.emitterX + (leafRandom(index, 1) - 0.5) * cfg.emitterWidth;
	const y0 = cfg.emitterY - leafRandom(index, 2) * cfg.emitterHeight;
	const speed = cfg.fallSpeed * (1 + (leafRandom(index, 3) - 0.5) * 2 * cfg.fallJitter);
	const cycle = (y0 - cfg.floorY) / speed;
	return {
		x0,
		y0,
		speed,
		cycle,
		phase: leafRandom(index, 4) * cycle, // desynchronise the field
		scale: cfg.minScale + leafRandom(index, 5) * (cfg.maxScale - cfg.minScale),
		back: leafRandom(index, 6) < cfg.backRatio,
	};
};

export interface LeafPose {
	x: number;
	y: number;
	rotX: number;
	rotY: number;
	rotZ: number;
	scale: number;
	back: boolean;
}

/** World pose of leaf `index` at time `t` (seconds). Pure: same (index, t, cfg) → same pose. */
export const leafPose = (index: number, t: number, cfg: LeafFieldConfig): LeafPose => {
	const s = leafSpawn(index, cfg);
	const elapsed = (t + s.phase) % s.cycle; // seconds since (re)birth
	const gust = 1 + cfg.windStrength * Math.sin(t * cfg.windFreq * TWO_PI + leafRandom(index, 7) * TWO_PI);
	const flutter = Math.sin(elapsed * cfg.swayFreq * TWO_PI + leafRandom(index, 8) * TWO_PI) * cfg.sway;
	return {
		x: s.x0 + elapsed * cfg.drift * gust + flutter,
		y: s.y0 - elapsed * s.speed,
		rotX: Math.sin(elapsed * cfg.spinSpeed * 0.7 + leafRandom(index, 9) * TWO_PI) * 0.9,
		rotY: Math.sin(elapsed * cfg.spinSpeed * 0.5 + leafRandom(index, 10) * TWO_PI) * 0.7,
		rotZ: elapsed * cfg.spinSpeed * (0.5 + leafRandom(index, 11)) + leafRandom(index, 12) * TWO_PI,
		scale: s.scale,
		back: s.back,
	};
};
```

- [ ] **Step 4: Run tests**

Run: `yarn vitest run src/common/leaves.test.ts && yarn lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/common/leaves.ts src/common/leaves.test.ts
git commit -m "feat: pure deterministic leaf-field math for the lobby leaves"
```

---

### Task 3: Placeholder intro assets (script + generated PNGs)

The real art will be AI-generated later with the existing green-screen pipeline (`scripts/cutout_layers.py`). This task generates **procedural placeholders at the final paths** so every later task is fully wireable and shippable; swapping the art is then a file overwrite with zero code changes.

**Files:**
- Create: `scripts/make_intro_placeholders.py`
- Create (generated): `public/images/intro/stroke-1.png`, `stroke-2.png`, `stroke-3.png`, `leaf-1.png`, `calligraphy.png`, `veil-1.png`, `veil-2.png`, `veil-3.png`

**Interfaces:**
- Produces: the eight PNG paths above. Button strokes are WHITE shapes on transparent background (they are used as CSS `mask-image`, so the colour comes from CSS — any tone can be applied). `leaf-1.png` is a red maple leaf sprite (used as a texture, actual colour). `calligraphy.png` is black ink on transparent. `veil-*.png` are white-on-transparent giant strokes (mask-image, coloured by CSS).

- [ ] **Step 1: Write the generator**

Create `scripts/make_intro_placeholders.py`:

```python
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
    """A ragged horizontal brush band: stacked noisy ellipses + speckle erosion at the edges."""
    rng = random.Random(seed)
    img = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(img)
    cy = h // 2
    for x in range(0, w, 4):
        t = x / w
        end = min(t, 1 - t) / (1 - taper) if taper < 1 else 1.0
        swell = 0.55 + 0.45 * math.sin(t * math.pi) + rng.uniform(-0.18, 0.18)
        r = max(2, int(h * 0.34 * swell * min(1.0, end * 3.2)))
        wob = int(math.sin(t * 9 + seed) * h * 0.05) + rng.randint(-2, 2)
        d.ellipse([x - r, cy - r + wob, x + r, cy + r + wob], fill=255)
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    # Dry-brush erosion: punch small holes near the contour.
    px = img.load()
    for _ in range(w * h // 55):
        x, y = rng.randrange(w), rng.randrange(h)
        if 24 < px[x, y] < 235:
            d.ellipse([x - 2, y - 1, x + 2, y + 1], fill=0)
    rgba = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    rgba.putalpha(img.point(lambda v: 0 if v < 28 else v))
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
```

- [ ] **Step 2: Run it and verify output**

Run: `python3 -c "import PIL" 2>/dev/null || python3 -m pip install --user pillow; python3 scripts/make_intro_placeholders.py && ls -la public/images/intro/`
Expected: `wrote placeholder art to …/public/images/intro` and 8 PNG files listed, each > 1 KB.

- [ ] **Step 3: Commit**

```bash
git add scripts/make_intro_placeholders.py public/images/intro
git commit -m "feat: procedural placeholder art for the lobby intro (strokes, leaf, calligraphy, veil)"
```

---

### Task 4: `ParallaxLayer` extensions (`centerX`, `onMaterial`)

Backwards-compatible additions so the lobby can (a) offset the tree layer left, (b) collect layer materials to drive the entry-cinematic timeline. No behaviour change with defaults.

**Files:**
- Modify: `src/common/components/atoms/ParallaxLayer/ParallaxLayer.tsx`

**Interfaces:**
- Produces: `ParallaxLayerProps` gains `centerX?: number` (default 0 — added to the parallax x target and the initial position) and `onMaterial?: (mat: THREE.MeshBasicMaterial) => void` (fired once when the texture is ready — Task 7's timeline hook).

- [ ] **Step 1: Apply the modification**

In `ParallaxLayer.tsx`, extend props and use them:

```tsx
export interface ParallaxLayerProps {
	url: string;
	/** 0 = far/still, 1 = near/moves most. Scales both pointer-parallax and idle drift. */
	depth: number;
	/** Phase offset so layers don't drift in lockstep. */
	phase: number;
	z: number;
	renderOrder: number;
	width: number;
	height: number;
	centerY: number;
	/** Horizontal anchor of the panel (world). The parallax/drift oscillates AROUND it. */
	centerX?: number;
	parallaxX: number;
	parallaxY: number;
	driftAmp: number;
	driftSpeed: number;
	/** Easing toward the target position (0–1 per frame). */
	lerp?: number;
	/** Fired once when the material exists — lets a parent drive opacity (intro paint-on). */
	onMaterial?: (mat: THREE.MeshBasicMaterial) => void;
}
```

In the component: add `centerX = 0` and `onMaterial` to the destructuring; change the `useFrame` x target line to

```tsx
		const targetX = centerX + state.pointer.x * parallaxX * depth + drift;
```

change the mesh position to `position={[centerX, centerY, z]}`; and register the material via a ref-callback on the material element (fires once, outside render):

```tsx
	const notified = useRef(false);
	const materialRef = (mat: THREE.MeshBasicMaterial | null) => {
		if (mat && !notified.current) {
			notified.current = true;
			onMaterial?.(mat);
		}
	};
```

and on the material element: `<meshBasicMaterial ref={materialRef} map={texture} transparent toneMapped={false} depthWrite={false} />`.

- [ ] **Step 2: Verify no regression**

Run: `yarn lint && yarn build && yarn test`
Expected: all green (Stage renders identically — defaults unchanged).

- [ ] **Step 3: Commit**

```bash
git add src/common/components/atoms/ParallaxLayer/ParallaxLayer.tsx
git commit -m "feat: ParallaxLayer centerX anchor + onMaterial hook (intro groundwork)"
```

---

### Task 5: `Mist` atom (procedural drifting fog bands)

**Files:**
- Create: `src/common/mistTexture.ts`
- Create: `src/common/components/atoms/Mist/Mist.tsx`
- Create: `src/common/components/atoms/Mist/index.ts`
- Modify: `src/common/components/atoms/index.ts` (add `export * from "./Mist";`)

**Interfaces:**
- Consumes: `LOBBY.mist` shape.
- Produces: `MIST_TEXTURE` (module-level `THREE.CanvasTexture`, same idiom as `floorTexture.ts`) and `<Mist bands opacity speed height y width />` where `y` is the world-Y of the band-cluster centre and `width` the covered width. Renders at `renderOrder={-50}` (in front of the stage panels −100…−95, behind the floor −10).

- [ ] **Step 1: Implement `src/common/mistTexture.ts`**

```ts
import * as THREE from "three";

// Soft paper-white fog band: opaque-ish cream core fading to transparent top & bottom.
// Colour lives here (the material stays white-tinted); built once at module load, same
// idiom as floorTexture.ts / cardAlpha.ts.

const buildMist = (): THREE.Texture => {
	const W = 512;
	const H = 128;
	const canvas = document.createElement("canvas");
	canvas.width = W;
	canvas.height = H;
	const ctx = canvas.getContext("2d")!;
	const g = ctx.createLinearGradient(0, 0, 0, H);
	g.addColorStop(0, "rgba(236,228,208,0)");
	g.addColorStop(0.5, "rgba(236,228,208,1)");
	g.addColorStop(1, "rgba(236,228,208,0)");
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, W, H);
	// Horizontal unevenness so the band reads as vapour, not a rule: carve soft random dips.
	ctx.globalCompositeOperation = "destination-out";
	for (let i = 0; i < 26; i++) {
		const x = (i * 97) % W; // deterministic scatter (no Math.random — stable across reloads)
		const r = 18 + ((i * 41) % 30);
		const grad = ctx.createRadialGradient(x, (i % 2) * H, 0, x, (i % 2) * H, r * 2);
		grad.addColorStop(0, "rgba(0,0,0,0.75)");
		grad.addColorStop(1, "rgba(0,0,0,0)");
		ctx.fillStyle = grad;
		ctx.fillRect(x - r * 2, 0, r * 4, H);
	}
	const tex = new THREE.CanvasTexture(canvas);
	tex.wrapS = THREE.RepeatWrapping; // the bands scroll horizontally forever
	tex.needsUpdate = true;
	return tex;
};

export const MIST_TEXTURE = buildMist();
```

- [ ] **Step 2: Implement `Mist.tsx`**

```tsx
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MIST_TEXTURE } from "../../../mistTexture";

export interface MistProps {
	bands: number;
	opacity: number;
	/** Horizontal drift in world units/s (each band alternates direction). */
	speed: number;
	/** World height of one band. */
	height: number;
	/** World-Y centre of the band cluster. */
	y: number;
	width: number;
	z?: number;
}

/** Slow-drifting paper-white fog bands over the horizon — the lobby's sense of waiting. */
export const Mist = ({ bands, opacity, speed, height, y, width, z = -0.05 }: MistProps) => {
	const group = useRef<THREE.Group>(null);

	// Scroll the texture offset (not the meshes): seamless wrap, zero re-layout.
	useFrame((state) => {
		const g = group.current;
		if (!g) return;
		g.children.forEach((mesh, i) => {
			const mat = (mesh as THREE.Mesh).material as THREE.MeshBasicMaterial;
			if (mat.map) mat.map.offset.x = state.clock.elapsedTime * speed * (i % 2 === 0 ? 1 : -0.7) * (1 + i * 0.35);
		});
	});

	return (
		<group ref={group}>
			{Array.from({ length: bands }, (_, i) => (
				<mesh key={i} position={[0, y + (i - (bands - 1) / 2) * height * 0.55, z]} renderOrder={-50 + i}>
					<planeGeometry args={[width, height]} />
					{/* Each band CLONES the texture so the offsets scroll independently. */}
					<meshBasicMaterial map={MIST_TEXTURE.clone()} transparent opacity={opacity * (1 - i * 0.2)} toneMapped={false} depthWrite={false} />
				</mesh>
			))}
		</group>
	);
};
```

Create `index.ts`: `export { Mist } from "./Mist";` and add `export * from "./Mist";` to the atoms barrel.

Note: `MIST_TEXTURE.clone()` textures are created in render via the material prop — clone shares the GPU image; the materials themselves are JSX-declared (`<meshBasicMaterial>`), so R3F disposes them on unmount (the manual-dispose rule applies only to `new THREE.Material` passed as objects).

- [ ] **Step 3: Verify**

Run: `yarn lint && yarn build`
Expected: green (atom not yet mounted anywhere).

- [ ] **Step 4: Commit**

```bash
git add src/common/mistTexture.ts src/common/components/atoms/Mist src/common/components/atoms/index.ts
git commit -m "feat: Mist atom — procedural drifting fog bands"
```

---

### Task 6: `FallingLeaves` atom + `useLobbyControls` Leva hook

**Files:**
- Create: `src/common/hooks/useLobbyControls.ts`
- Create: `src/common/components/atoms/FallingLeaves/FallingLeaves.tsx`
- Create: `src/common/components/atoms/FallingLeaves/index.ts`
- Modify: `src/common/components/atoms/index.ts` (add `export * from "./FallingLeaves";`)

**Interfaces:**
- Consumes: `leafPose`, `type LeafFieldConfig` (Task 2), `LOBBY` (Task 1).
- Produces:
  - `useLobbyControls(): LobbyControls` — Leva folder "Lobby", `LobbyControls = { treeX; treeY; treeScale; leafCount; windStrength; drift; fallSpeed; mistOpacity; mistSpeed }`, defaults from `LOBBY`.
  - `<FallingLeaves cfg={LeafFieldConfig} visible={boolean} />` — one `THREE.InstancedMesh`, `renderOrder={5}` (front leaves) and a second instanced mesh `renderOrder={-45}` for back leaves (behind the mist at −50…−48? No: mist is −50, back leaves must be BEHIND it → `-55`), texture `/images/intro/leaf-1.png`.

- [ ] **Step 1: Implement `useLobbyControls.ts`**

```ts
import { useControls } from "leva";
import { LOBBY } from "../layout";

export interface LobbyControls {
	treeX: number;
	treeY: number;
	treeScale: number;
	leafCount: number;
	windStrength: number;
	drift: number;
	fallSpeed: number;
	mistOpacity: number;
	mistSpeed: number;
}

/** Live-tunable lobby-panorama knobs, in their own collapsed Leva folder (defaults: LOBBY). */
export const useLobbyControls = (): LobbyControls =>
	useControls(
		"Lobby",
		{
			treeX: { value: LOBBY.treeX, min: -4, max: 0, step: 0.05 },
			treeY: { value: LOBBY.treeY, min: -1.5, max: 1.5, step: 0.05 },
			treeScale: { value: LOBBY.treeScale, min: 1, max: 2.5, step: 0.05 },
			leafCount: { value: LOBBY.leaves.count, min: 0, max: 80, step: 1 },
			windStrength: { value: LOBBY.leaves.windStrength, min: 0, max: 1.5, step: 0.05 },
			drift: { value: LOBBY.leaves.drift, min: 0, max: 1, step: 0.02 },
			fallSpeed: { value: LOBBY.leaves.fallSpeed, min: 0.05, max: 0.8, step: 0.01 },
			mistOpacity: { value: LOBBY.mist.opacity, min: 0, max: 1, step: 0.02 },
			mistSpeed: { value: LOBBY.mist.speed, min: 0, max: 0.1, step: 0.002 },
		},
		{ collapsed: true },
	);
```

- [ ] **Step 2: Implement `FallingLeaves.tsx`**

```tsx
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { leafPose, leafSpawn, type LeafFieldConfig } from "../../../leaves";

const LEAF_URL = "/images/intro/leaf-1.png";
useTexture.preload(LEAF_URL);

const dummy = new THREE.Object3D();

interface LayerProps {
	cfg: LeafFieldConfig;
	indices: number[];
	renderOrder: number;
	opacity: number;
}

/** One instanced plane per depth layer; matrices are rewritten every frame from the pure field math. */
const LeafLayer = ({ cfg, indices, renderOrder, opacity }: LayerProps) => {
	const mesh = useRef<THREE.InstancedMesh>(null);
	const texture = useTexture(LEAF_URL, (loaded) => {
		const tex = Array.isArray(loaded) ? loaded[0] : loaded;
		tex.colorSpace = THREE.SRGBColorSpace;
	});

	useFrame((state) => {
		const m = mesh.current;
		if (!m) return;
		indices.forEach((leafIndex, i) => {
			const p = leafPose(leafIndex, state.clock.elapsedTime, cfg);
			dummy.position.set(p.x, p.y, 0);
			dummy.rotation.set(p.rotX, p.rotY, p.rotZ);
			dummy.scale.setScalar(p.scale);
			dummy.updateMatrix();
			m.setMatrixAt(i, dummy.matrix);
		});
		m.instanceMatrix.needsUpdate = true;
	});

	return (
		<instancedMesh ref={mesh} args={[undefined, undefined, indices.length]} renderOrder={renderOrder} frustumCulled={false}>
			<planeGeometry args={[1, 1]} />
			<meshBasicMaterial map={texture} transparent opacity={opacity} alphaTest={0.15} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
		</instancedMesh>
	);
};

export interface FallingLeavesProps {
	cfg: LeafFieldConfig;
	visible?: boolean;
}

/**
 * The maple leaves detaching from the lobby tree: GPU-instanced sprites on two depth planes —
 * most in front of the scenery, a pale few behind the mist. All motion comes from `leafPose`
 * (pure, deterministic), so the field never pops or respawns mid-air.
 */
export const FallingLeaves = ({ cfg, visible = true }: FallingLeavesProps) => {
	// Split the indices once per cfg: `back` is deterministic per index.
	const { front, back } = useMemo(() => {
		const front: number[] = [];
		const back: number[] = [];
		for (let i = 0; i < cfg.count; i++) (leafSpawn(i, cfg).back ? back : front).push(i);
		return { front, back };
	}, [cfg]);

	return (
		<group visible={visible}>
			{back.length > 0 && <LeafLayer cfg={cfg} indices={back} renderOrder={-55} opacity={0.55} />}
			{front.length > 0 && <LeafLayer cfg={cfg} indices={front} renderOrder={5} opacity={0.95} />}
		</group>
	);
};
```

Create `index.ts`: `export { FallingLeaves } from "./FallingLeaves";` and export from the atoms barrel.

- [ ] **Step 3: Verify**

Run: `yarn lint && yarn build && yarn test`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add src/common/hooks/useLobbyControls.ts src/common/components/atoms/FallingLeaves src/common/components/atoms/index.ts
git commit -m "feat: FallingLeaves instanced atom + Lobby leva folder"
```

---

### Task 7: `LobbyScene` section (panorama canvas + entry-cinematic timeline + skip)

**Files:**
- Create: `src/common/components/sections/LobbyScene/LobbyScene.tsx`
- Create: `src/common/components/sections/LobbyScene/index.ts`
- Modify: `src/common/components/sections/index.ts` (add `export * from "./LobbyScene";`)

**Interfaces:**
- Consumes: `ParallaxLayer` (`centerX`, `onMaterial` — Task 4), `Mist` (Task 5), `FallingLeaves` + `useLobbyControls` (Task 6), `FitCamera`, `Floor` + `useFloorControls`, `STAGE`, `STAGE_LAYERS`, `LOBBY`, `INTRO`, `HORIZON_FRACTION`, `frameViewport`, `DEFAULT_SCENE_FRAME`, `PAPER`, `useCoarsePointer`.
- Produces: `<LobbyScene intro={boolean} registerSkip={(fn: () => void) => void} onIntroEnd={() => void} />`.
  - `intro=false` → everything shown immediately, timeline skipped (used for reduced-motion and returns to the menu).
  - `registerSkip` hands the parent an imperative "finish the 3D cinematic now" function.
  - Renders the WebGL-failure fallback via the Canvas `fallback` prop (static washi backdrop `div`).

- [ ] **Step 1: Implement `LobbyScene.tsx`**

```tsx
import { Suspense, useCallback, useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Leva } from "leva";
import gsap from "gsap";
import * as THREE from "three";
import { FitCamera, Floor, FallingLeaves, Mist, ParallaxLayer } from "../../atoms";
import { useFloorControls } from "../../../hooks/useFloorControls";
import { useLobbyControls } from "../../../hooks/useLobbyControls";
import { useCoarsePointer } from "../../../hooks/useCoarsePointer";
import { DEFAULT_SCENE_FRAME, HORIZON_FRACTION, INTRO, LOBBY, PAPER, STAGE, STAGE_LAYERS, frameViewport } from "../../../layout";

const TREE_URL = "/images/backgroud/4-tree.png";

export interface LobbySceneProps {
	/** False = skip the cinematic entirely (reduced motion / intro already played). */
	intro: boolean;
	registerSkip: (skip: () => void) => void;
	onIntroEnd: () => void;
}

interface PanoramaProps extends LobbySceneProps {
	leafVisibleRef: React.MutableRefObject<boolean>;
}

/**
 * The lobby's living panorama: the game's stage art re-staged (tree pulled LEFT and enlarged —
 * it is the leaves' source), plus mist and the falling leaves. The entry cinematic is ONE gsap
 * timeline over the layer materials (paint-on far → near) so a tap can `progress(1)` all of it.
 */
const Panorama = ({ intro, registerSkip, onIntroEnd, leafVisibleRef }: PanoramaProps) => {
	const c = useLobbyControls();
	const size = useThree((s) => s.size);
	const frame = DEFAULT_SCENE_FRAME;
	const floor = useFloorControls("landscape");

	// Panorama sizing — mirrors Stage (visible width, native aspect, horizon strip).
	const horizonY = frame.top - (frame.top - frame.bottom) * HORIZON_FRACTION;
	const visibleWidth = frameViewport(frame, size.width / size.height).width;
	const width = visibleWidth * STAGE.widthOverscan * STAGE.scale;
	const height = width / STAGE.imageAspect;
	const centerY = (frame.top + horizonY) / 2 + STAGE.lift;

	// --- Entry cinematic: collect layer materials, then build one master timeline. ---
	const materials = useRef(new Map<string, THREE.MeshBasicMaterial>());
	const timeline = useRef<gsap.core.Timeline | null>(null);
	const done = useRef(!intro);
	const expected = STAGE_LAYERS.length + 1; // base+sun+mountains(+tree replaced) + lobby tree

	const finish = useCallback(() => {
		if (done.current) return;
		done.current = true;
		timeline.current?.progress(1);
		leafVisibleRef.current = true;
		onIntroEnd();
	}, [leafVisibleRef, onIntroEnd]);

	useEffect(() => {
		registerSkip(finish);
	}, [registerSkip, finish]);

	const onLayerMaterial = useCallback(
		(url: string) => (mat: THREE.MeshBasicMaterial) => {
			if (done.current) return; // intro over (or off): leave everything fully painted
			mat.opacity = 0;
			materials.current.set(url, mat);
			if (materials.current.size < expected || timeline.current) return;
			// All layers ready → paint them on far → near, then release the leaves, then hand off to the DOM.
			const tl = gsap.timeline({ defaults: { ease: "power2.out", overwrite: true } });
			[...materials.current.entries()].forEach(([, m], i) => {
				tl.to(m, { opacity: 1, duration: INTRO.layerFade }, i * INTRO.layerStagger);
			});
			tl.call(() => (leafVisibleRef.current = true), undefined, INTRO.leavesDelay);
			tl.call(finish, undefined, Math.max(tl.duration(), INTRO.menuDelay));
			timeline.current = tl;
		},
		[expected, finish, leafVisibleRef],
	);

	useEffect(
		() => () => {
			timeline.current?.kill();
		},
		[],
	);

	// The shared painting minus the tree (the lobby re-stages it), same paint order as Stage.
	const layers = STAGE_LAYERS.filter((l) => l.url !== TREE_URL);

	return (
		<>
			<color attach="background" args={[PAPER]} />
			<FitCamera frame={frame} />
			<Suspense fallback={null}>
				{layers.map((layer, i) => (
					<ParallaxLayer
						key={layer.url}
						url={layer.url}
						depth={layer.depth}
						phase={layer.phase}
						z={STAGE.planeZ}
						renderOrder={-100 + i}
						width={width}
						height={height}
						centerY={centerY + (layer.y ?? 0)}
						parallaxX={STAGE.parallaxX}
						parallaxY={STAGE.parallaxY}
						driftAmp={STAGE.driftAmp}
						driftSpeed={STAGE.driftSpeed}
						onMaterial={onLayerMaterial(layer.url)}
					/>
				))}
				{/* The maple tree, re-staged: left edge, enlarged, nearest depth — the leaves' source. */}
				<ParallaxLayer
					url={TREE_URL}
					depth={0.62}
					phase={0.6}
					z={STAGE.planeZ + 0.02}
					renderOrder={-60}
					width={width * c.treeScale}
					height={(width * c.treeScale) / STAGE.imageAspect}
					centerY={centerY + c.treeY}
					centerX={c.treeX}
					parallaxX={STAGE.parallaxX}
					parallaxY={STAGE.parallaxY}
					driftAmp={STAGE.driftAmp}
					driftSpeed={STAGE.driftSpeed}
					onMaterial={onLayerMaterial(TREE_URL)}
				/>
				<Floor frame={frame} controls={floor} orientation="landscape" />
			</Suspense>
			<Mist bands={LOBBY.mist.bands} opacity={c.mistOpacity} speed={c.mistSpeed} height={LOBBY.mist.height} y={horizonY + LOBBY.mist.y} width={visibleWidth * 1.2} />
			<LeafField cfg={{ ...LOBBY.leaves, count: c.leafCount, windStrength: c.windStrength, drift: c.drift, fallSpeed: c.fallSpeed }} visibleRef={leafVisibleRef} />
		</>
	);
};

/** Bridges the timeline's imperative "leaves on" flag into the leaf group's visibility. */
const LeafField = ({ cfg, visibleRef }: { cfg: typeof LOBBY.leaves; visibleRef: React.MutableRefObject<boolean> }) => {
	const group = useRef<THREE.Group>(null);
	useFrame(() => {
		if (group.current) group.current.visible = visibleRef.current;
	});
	return (
		<group ref={group} visible={false}>
			<FallingLeaves cfg={cfg} />
		</group>
	);
};

/** Static washi fallback when WebGL is unavailable — the menu must always work. */
const StaticFallback = () => (
	<div
		style={{
			position: "absolute",
			inset: 0,
			backgroundColor: "#e9e2d2",
			backgroundImage: "url(/images/backgroud/complete.jpeg)",
			backgroundSize: "cover",
			backgroundPosition: "center",
		}}
	/>
);

/** The lobby's animated backdrop canvas. Fills its parent; pointer events pass through to the page. */
export const LobbyScene = ({ intro, registerSkip, onIntroEnd }: LobbySceneProps) => {
	const coarse = useCoarsePointer();
	const leafVisibleRef = useRef(!intro);
	return (
		<div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
			<Leva collapsed hidden={import.meta.env.PROD || coarse} />
			<Canvas dpr={coarse ? [1, 1.5] : [1, 2]} camera={{ position: [0, 0, 6], fov: 30 }} fallback={<StaticFallback />}>
				<Panorama intro={intro} registerSkip={registerSkip} onIntroEnd={onIntroEnd} leafVisibleRef={leafVisibleRef} />
			</Canvas>
		</div>
	);
};
```

Add the missing import `useFrame` from `@react-three/fiber` in the same import statement as `Canvas, useThree`.

Create `index.ts`: `export { LobbyScene } from "./LobbyScene";` and add to the sections barrel.

Note on the eslint-react-hooks 7 rules: `leafVisibleRef` is only READ inside `useFrame` (not render) and mutated in gsap callbacks — both allowed. `done`/`materials`/`timeline` refs are likewise only touched in effects/callbacks.

- [ ] **Step 2: Verify**

Run: `yarn lint && yarn build && yarn test`
Expected: green (section not yet mounted).

- [ ] **Step 3: Commit**

```bash
git add src/common/components/sections/LobbyScene src/common/components/sections/index.ts
git commit -m "feat: LobbyScene — animated panorama canvas with entry-cinematic timeline and skip"
```

---

### Task 8: DOM primitives — `InkStrokeButton`, `HankoStamp`, `LobbyColumn`, light `TextField`

**Files:**
- Create: `src/common/components/atoms/InkStrokeButton/InkStrokeButton.tsx`
- Create: `src/common/components/atoms/InkStrokeButton/index.ts`
- Modify: `src/common/components/atoms/index.ts` (add `export * from "./InkStrokeButton";`)
- Modify: `src/common/net/components/ui.tsx` (add `HankoStamp`, `LobbyColumn`, `usePortraitWindow`; restyle `TextField` for the light paper look; KEEP `Backdrop`/`Panel`/`InkButton` exported for now — Task 9 removes the leftovers)

**Interfaces:**
- Consumes: `INTRO` (delays), stroke PNGs from Task 3.
- Produces:
  - `<InkStrokeButton onClick disabled tone?: "ink" | "red" | "blue" | "ghost" variant?: 0|1|2 seal?: boolean delay?: number>` — the stroke PNG is a CSS **mask** over a colour fill (so any tone shares the same brush shape); paint-on = animated `clip-path` left→right after `delay`; hover = the stroke stretches (`scaleX 1.04`) and the label letter-spacing opens ("bleeding ink").
  - `<HankoStamp>{keyword}</HankoStamp>` — vermilion seal block, display font, slight rotation.
  - `<LobbyColumn>{children}</LobbyColumn>` — landscape: fixed right column (`width: LOBBY.columnWidthPct %`, right-aligned content); portrait window: centred column. Uses `usePortraitWindow()` (matchMedia `(orientation: portrait)`, same idiom as `useCoarsePointer`).

- [ ] **Step 1: Implement `InkStrokeButton.tsx`**

```tsx
import type { CSSProperties, ReactNode } from "react";
import { motion } from "motion/react";

const STROKES = ["/images/intro/stroke-1.png", "/images/intro/stroke-2.png", "/images/intro/stroke-3.png"];

const TONES = {
	ink: "#17120e",
	red: "#b73225",
	blue: "#2f6f86",
	ghost: "rgba(23, 18, 14, 0.34)",
} as const;

export interface InkStrokeButtonProps {
	children: ReactNode;
	onClick?: () => void;
	disabled?: boolean;
	tone?: keyof typeof TONES;
	/** Which brush texture (rotated variants keep siblings from looking cloned). */
	variant?: 0 | 1 | 2;
	/** Vermilion hanko dot at the stroke's end — the primary action's mark. */
	seal?: boolean;
	/** Seconds before the stroke paints itself on (intro choreography; 0 = already painted). */
	delay?: number;
	style?: CSSProperties;
}

/**
 * A floating sumi brush stroke that IS the button: the PNG is a mask over a colour fill, so
 * every tone shares the real brush silhouette. Paints on left→right (clip-path), and on hover
 * the ink "bleeds" — the stroke stretches a touch and the label's tracking opens.
 */
export const InkStrokeButton = ({ children, onClick, disabled, tone = "ink", variant = 0, seal = false, delay = 0, style }: InkStrokeButtonProps) => {
	const mask = `url(${STROKES[variant]})`;
	return (
		<motion.button
			type="button"
			disabled={disabled}
			onClick={onClick}
			initial="hidden"
			animate="painted"
			whileHover={disabled ? undefined : "bleed"}
			whileTap={disabled ? undefined : { scale: 0.97 }}
			style={{
				position: "relative",
				width: "100%",
				height: 58,
				padding: 0,
				background: "none",
				border: "none",
				cursor: disabled ? "default" : "pointer",
				opacity: disabled ? 0.4 : 1,
				...style,
			}}
		>
			<motion.span
				variants={{
					hidden: { clipPath: "inset(0 100% 0 0)" },
					painted: { clipPath: "inset(0 0% 0 0)", transition: { delay, duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
					bleed: { clipPath: "inset(0 0% 0 0)", scaleX: 1.04, scaleY: 1.08, transition: { duration: 0.25 } },
				}}
				style={{
					position: "absolute",
					inset: 0,
					background: TONES[tone],
					WebkitMaskImage: mask,
					maskImage: mask,
					WebkitMaskSize: "100% 100%",
					maskSize: "100% 100%",
					filter: "drop-shadow(0 6px 12px rgba(0, 0, 0, 0.35))",
				}}
			/>
			<motion.span
				variants={{
					hidden: { opacity: 0 },
					painted: { opacity: 1, letterSpacing: "3px", transition: { delay: delay + 0.25, duration: 0.35 } },
					bleed: { opacity: 1, letterSpacing: "4.5px", transition: { duration: 0.25 } },
				}}
				style={{
					position: "relative",
					color: "#f2ead9",
					fontSize: 15,
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
						hidden: { opacity: 0, scale: 0.4 },
						painted: { opacity: 1, scale: 1, transition: { delay: delay + 0.45, duration: 0.3 } },
					}}
					style={{
						position: "absolute",
						right: -6,
						top: "50%",
						width: 16,
						height: 16,
						marginTop: -8,
						background: "#b73225",
						borderRadius: 4,
						transform: "rotate(-6deg)",
						boxShadow: "0 2px 6px rgba(0, 0, 0, 0.3)",
					}}
				/>
			)}
		</motion.button>
	);
};
```

Create `index.ts`: `export { InkStrokeButton } from "./InkStrokeButton";`, add to the atoms barrel.

- [ ] **Step 2: Add the new primitives to `ui.tsx`**

Append to `src/common/net/components/ui.tsx` (keep the existing exports untouched in this task):

```tsx
import { useEffect, useState } from "react";
import { LOBBY } from "../../layout";

/** True when the WINDOW is portrait — DOM-side twin of the canvas-size check the scenes use. */
export const usePortraitWindow = (): boolean => {
	const [portrait, setPortrait] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(orientation: portrait)").matches);
	useEffect(() => {
		const mq = window.matchMedia("(orientation: portrait)");
		const onChange = () => setPortrait(mq.matches);
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, []);
	return portrait;
};

/** Vermilion seal stamp — the waiting room's keyword reads as a hanko pressed on the paper. */
export const HankoStamp = ({ children }: { children: ReactNode }) => (
	<motion.div
		initial={{ opacity: 0, scale: 1.4 }}
		animate={{ opacity: 1, scale: 1 }}
		transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
		style={{
			alignSelf: "center",
			padding: "18px 26px",
			background: "#b73225",
			color: "#f5ede0",
			fontFamily: "var(--font-display)",
			fontSize: 26,
			letterSpacing: 4,
			borderRadius: 10,
			transform: "rotate(-2.5deg)",
			boxShadow: "0 6px 18px rgba(0, 0, 0, 0.3), inset 0 0 12px rgba(0, 0, 0, 0.22)",
			textTransform: "uppercase",
		}}
	>
		{children}
	</motion.div>
);

/**
 * The menu's home: a FIXED right column in landscape (the panorama flows behind it — no panel),
 * a centred stack in portrait. Pointer events re-enabled here (the backdrop layer disables them).
 */
export const LobbyColumn = ({ children }: { children: ReactNode }) => {
	const portrait = usePortraitWindow();
	return (
		<div
			style={{
				position: "absolute",
				top: 0,
				bottom: 0,
				right: portrait ? "50%" : "4%",
				transform: portrait ? "translateX(50%)" : "none",
				width: portrait ? "min(420px, 88vw)" : `${LOBBY.columnWidthPct}%`,
				maxWidth: 460,
				display: "flex",
				flexDirection: "column",
				justifyContent: "center",
				gap: 16,
				pointerEvents: "auto",
			}}
		>
			{children}
		</div>
	);
};
```

Also restyle `TextField` for the paper look — replace its `style` object with:

```tsx
		style={{
			width: "100%",
			padding: "12px 16px",
			fontSize: 16,
			letterSpacing: 1,
			color: "#17120e",
			background: "rgba(244, 238, 224, 0.85)",
			border: "1px solid rgba(23, 18, 14, 0.35)",
			borderRadius: 4,
			outline: "none",
			boxShadow: "inset 0 1px 4px rgba(0, 0, 0, 0.12)",
		}}
```

(Merge the new `import { useEffect, useState } from "react"` with the existing react type import; `ReactNode` is already imported.)

- [ ] **Step 3: Verify**

Run: `yarn lint && yarn build`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add src/common/components/atoms/InkStrokeButton src/common/components/atoms/index.ts src/common/net/components/ui.tsx
git commit -m "feat: InkStrokeButton, HankoStamp, LobbyColumn and paper TextField"
```

---

### Task 9: Rework the lobby screens (panorama + right column + intro delays + skip)

**Files:**
- Modify: `src/common/net/components/Lobby.tsx`
- Modify: `src/common/net/components/Menu.tsx`
- Modify: `src/common/net/components/MultiplayerLobby.tsx`
- Modify: `src/common/net/components/ui.tsx` (delete the now-unused `Backdrop`, `Panel`, `InkButton`)

**Interfaces:**
- Consumes: `LobbyScene` (Task 7), `InkStrokeButton` / `HankoStamp` / `LobbyColumn` (Task 8), `INTRO`, `useReducedMotion` from `motion/react`.
- Produces: `Menu` prop change → `({ onMultiplayer, delayFor }: { onMultiplayer: () => void; delayFor: (i: number) => number })`; `MultiplayerLobby` keeps `{ onBack }`. `Lobby`'s public API is unchanged (no props).

- [ ] **Step 1: Rewrite `Lobby.tsx`**

```tsx
import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useSession } from "../useSession";
import { useNetDiagnostics } from "../diagnostics";
import { LobbyScene } from "../../components/sections";
import { InkStrokeButton } from "../../components/atoms";
import { INTRO } from "../../layout";
import { Menu } from "./Menu";
import { MultiplayerLobby } from "./MultiplayerLobby";
import { HankoStamp, LobbyColumn } from "./ui";

// The cinematic plays once per app load — coming back from a game (or the multiplayer flow)
// re-enters a lobby that is already "awake".
let introPlayed = false;

/** On-screen connection health (mobile has no console) — unchanged behaviour, restyled for paper. */
const NetDiagLine = () => {
	const { ice, joinError, relays, rtc } = useNetDiagnostics();
	return (
		<p style={{ margin: 0, fontSize: 11, opacity: 0.5, textAlign: "center", letterSpacing: 1, lineHeight: 1.6, color: "#17120e" }}>
			relay {relays ? `${relays.open}/${relays.total}` : "…"} · {ice ?? "ICE…"} · rtc {rtc ?? "–"}
			{joinError && (
				<>
					<br />
					<span style={{ color: "#b73225", wordBreak: "break-all" }}>errore: {joinError}</span>
				</>
			)}
		</p>
	);
};

/** Shared cross-fade wrapper: every lobby screen slides/fades in the SAME column — the panorama never blinks. */
const ScreenFade = ({ children, id }: { children: React.ReactNode; id: string }) => (
	<motion.div
		key={id}
		initial={{ opacity: 0, y: 14 }}
		animate={{ opacity: 1, y: 0 }}
		exit={{ opacity: 0, y: -10 }}
		transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
		style={{ display: "flex", flexDirection: "column", gap: 16 }}
	>
		{children}
	</motion.div>
);

/**
 * Full-screen lobby (`status !== "playing"`): the living panorama behind, the ink-stroke menu in
 * the right column. First load plays the entry cinematic; a tap anywhere skips it (a tap on a
 * button ALSO activates it — the buttons are clickable as soon as they're visible).
 */
export const Lobby = () => {
	const { status, roomKeyword, leave } = useSession();
	const [screen, setScreen] = useState<"root" | "mp">("root");
	const reduced = useReducedMotion();
	const [introDone, setIntroDone] = useState(() => introPlayed || !!reduced);
	const skip3D = useRef<() => void>(() => {});

	const finishIntro = useCallback(() => {
		introPlayed = true;
		skip3D.current();
		setIntroDone(true);
	}, []);

	// DOM elements pick their paint-on delay from the intro beat map — 0 once the intro is over.
	const delayFor = (i: number) => (introDone ? 0 : INTRO.menuDelay + i * INTRO.menuStagger);

	const backToMenu = () => {
		leave();
		setScreen("root");
	};

	return (
		<div style={{ position: "fixed", inset: 0, zIndex: 3000, overflow: "hidden" }} onPointerDown={introDone ? undefined : finishIntro}>
			<LobbyScene intro={!introDone} registerSkip={(fn) => (skip3D.current = fn)} onIntroEnd={finishIntro} />

			{/* Calligraphy watermark behind the column (landscape flavour; harmless in portrait). */}
			<motion.img
				src="/images/intro/calligraphy.png"
				alt=""
				initial={{ opacity: 0, clipPath: "inset(0 0 100% 0)" }}
				animate={{ opacity: 0.15, clipPath: "inset(0 0 0% 0)" }}
				transition={{ delay: delayFor(0), duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
				style={{ position: "absolute", right: "30%", top: "6%", height: "70%", pointerEvents: "none" }}
			/>

			<LobbyColumn>
				<motion.img
					src="/images/logo/kiri-ai-logo.png"
					alt="Kiri-ai: The Duel"
					initial={{ opacity: 0, y: -12, filter: "blur(6px)" }}
					animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
					transition={{ delay: delayFor(1), duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
					style={{ width: "82%", alignSelf: "center", filter: "drop-shadow(0 6px 18px rgba(0, 0, 0, 0.35))" }}
				/>

				<AnimatePresence mode="wait">
					{status === "menu" &&
						(screen === "root" ? (
							<ScreenFade id="root">
								<Menu onMultiplayer={() => setScreen("mp")} delayFor={delayFor} />
							</ScreenFade>
						) : (
							<ScreenFade id="mp">
								<MultiplayerLobby onBack={() => setScreen("root")} />
							</ScreenFade>
						))}

					{status === "waiting" && (
						<ScreenFade id="waiting">
							<p style={{ margin: 0, textAlign: "center", color: "#17120e", fontSize: 15, letterSpacing: 2 }}>
								In attesa… condividi la parola chiave
							</p>
							<HankoStamp>{roomKeyword}</HankoStamp>
							<p style={{ margin: 0, fontSize: 13, opacity: 0.65, textAlign: "center", color: "#17120e" }}>
								Non appena si unisce, la partita inizia.
							</p>
							<NetDiagLine />
							<InkStrokeButton tone="ghost" variant={2} onClick={backToMenu}>
								ANNULLA
							</InkStrokeButton>
						</ScreenFade>
					)}

					{status === "peer-left" && (
						<ScreenFade id="peer-left">
							<p style={{ margin: 0, textAlign: "center", color: "#17120e", fontSize: 17, letterSpacing: 2 }}>
								Avversario uscito — la partita è stata interrotta
							</p>
							<InkStrokeButton onClick={backToMenu} seal>
								TORNA AL MENU
							</InkStrokeButton>
						</ScreenFade>
					)}
				</AnimatePresence>
			</LobbyColumn>
		</div>
	);
};
```

- [ ] **Step 2: Rewrite `Menu.tsx`**

```tsx
import { useSession } from "../useSession";
import { InkStrokeButton } from "../../components/atoms";

/** Root screen: the two mode strokes floating on the panorama (the logo lives in Lobby's column). */
export const Menu = ({ onMultiplayer, delayFor }: { onMultiplayer: () => void; delayFor: (i: number) => number }) => {
	const { startLocal } = useSession();
	return (
		<>
			<InkStrokeButton onClick={startLocal} variant={0} seal delay={delayFor(2)}>
				PASSA E GIOCA
			</InkStrokeButton>
			<InkStrokeButton onClick={onMultiplayer} variant={1} delay={delayFor(3)}>
				MULTIPLAYER
			</InkStrokeButton>
			<p style={{ margin: "2px 0 0", fontSize: 12, opacity: 0.55, textAlign: "center", lineHeight: 1.5, color: "#17120e" }}>
				Passa e gioca sullo stesso dispositivo, oppure sfida un avversario online.
			</p>
		</>
	);
};
```

- [ ] **Step 3: Restyle `MultiplayerLobby.tsx`**

Same logic/flow, new primitives (no Panel — headings as ink text):

```tsx
import { useState } from "react";
import type { Team } from "../../game";
import { useSession } from "../useSession";
import { InkStrokeButton } from "../../components/atoms";
import { TextField } from "./ui";

type View = "choose" | "create" | "join";

const TEAM_LABEL: Record<Team, string> = { red: "ROSSO", blue: "BLU" };

const Heading = ({ title, subtitle }: { title: string; subtitle: string }) => (
	<div style={{ textAlign: "center", color: "#17120e" }}>
		<h1 style={{ margin: 0, fontSize: 28, letterSpacing: 4, fontFamily: "var(--font-display)" }}>{title}</h1>
		<p style={{ margin: "6px 0 0", fontSize: 13, opacity: 0.65 }}>{subtitle}</p>
	</div>
);

/** Multiplayer lobby: create a room (keyword + colour) or join one (keyword → the other colour). */
export const MultiplayerLobby = ({ onBack }: { onBack: () => void }) => {
	const { createRoom, joinRoom } = useSession();
	const [view, setView] = useState<View>("choose");
	const [keyword, setKeyword] = useState("");
	const [color, setColor] = useState<Team>("red");

	const trimmed = keyword.trim();

	if (view === "choose") {
		return (
			<>
				<Heading title="Multiplayer" subtitle="Crea una partita o unisciti a una esistente" />
				<InkStrokeButton tone="red" variant={0} onClick={() => setView("create")}>
					CREA PARTITA
				</InkStrokeButton>
				<InkStrokeButton tone="blue" variant={1} onClick={() => setView("join")}>
					UNISCITI
				</InkStrokeButton>
				<InkStrokeButton tone="ghost" variant={2} onClick={onBack}>
					← INDIETRO
				</InkStrokeButton>
			</>
		);
	}

	if (view === "create") {
		return (
			<>
				<Heading title="Crea partita" subtitle="Scegli una parola chiave e il tuo colore" />
				<TextField value={keyword} onChange={setKeyword} placeholder="Parola chiave (es. duello)" onEnter={() => trimmed && createRoom(trimmed, color)} />
				<div style={{ display: "flex", gap: 10 }}>
					{(["red", "blue"] as Team[]).map((t) => (
						<InkStrokeButton key={t} tone={color === t ? t : "ghost"} variant={t === "red" ? 0 : 1} onClick={() => setColor(t)}>
							{TEAM_LABEL[t]}
						</InkStrokeButton>
					))}
				</div>
				<InkStrokeButton disabled={!trimmed} seal onClick={() => createRoom(trimmed, color)}>
					CREA E ATTENDI
				</InkStrokeButton>
				<InkStrokeButton tone="ghost" variant={2} onClick={() => setView("choose")}>
					← INDIETRO
				</InkStrokeButton>
			</>
		);
	}

	return (
		<>
			<Heading title="Unisciti" subtitle="Inserisci la parola chiave della partita" />
			<TextField value={keyword} onChange={setKeyword} placeholder="Parola chiave" onEnter={() => trimmed && joinRoom(trimmed)} />
			<p style={{ margin: 0, fontSize: 12, opacity: 0.6, textAlign: "center", color: "#17120e" }}>
				Ti verrà assegnato il colore opposto a chi ha creato la partita.
			</p>
			<InkStrokeButton disabled={!trimmed} seal onClick={() => joinRoom(trimmed)}>
				UNISCITI
			</InkStrokeButton>
			<InkStrokeButton tone="ghost" variant={2} onClick={() => setView("choose")}>
				← INDIETRO
			</InkStrokeButton>
		</>
	);
};
```

- [ ] **Step 4: Delete dead primitives**

In `ui.tsx` remove `Backdrop`, `Panel`, `InkButton` (and their now-unused imports). Grep first:

Run: `grep -rn "Backdrop\|Panel\|InkButton" src --include="*.tsx" --include="*.ts" | grep -v "ui.tsx"`
Expected: no remaining consumers (WaitingOverlay does not use them). If any remain, migrate them to `InkStrokeButton`/`LobbyColumn` before deleting.

- [ ] **Step 5: Verify visually + suite**

Run: `yarn lint && yarn build && yarn test`, then `yarn dev` and check manually:
- Reload → cinematic: layers paint far→near, leaves start after ~1.8 s, calligraphy + logo + strokes paint from ~2.5 s.
- Tap during the cinematic → everything completes instantly.
- Full flow: MULTIPLAYER → CREA → keyword form; waiting screen shows the hanko keyword + diag line; ANNULLA returns.
- Narrow window / device emulation portrait → column centres, panorama behind.
- Reload with DevTools "Emulate CSS prefers-reduced-motion" → menu appears immediately, no cinematic.

- [ ] **Step 6: Commit**

```bash
git add src/common/net/components
git commit -m "feat: lobby rework — living panorama, right ink-stroke column, skippable entry cinematic"
```

---

### Task 10: `InkTransition` veil + `AppRoot` wiring

**Files:**
- Create: `src/common/components/sections/InkTransition/InkTransition.tsx`
- Create: `src/common/components/sections/InkTransition/index.ts`
- Modify: `src/common/components/sections/index.ts`
- Modify: `src/AppRoot.tsx`

**Interfaces:**
- Consumes: `INTRO` veil timings, veil PNGs (Task 3), `useReducedMotion`.
- Produces:
  - `<InkTransition covering={boolean} release={boolean} onCovered={() => void} />` — when `covering` flips true, 4 giant strokes sweep in one after another (staggered, alternating angles/directions) and a sealing layer closes the gaps → `onCovered()`. The veil then HOLDS full black until `release` is true, then the strokes "dry" out in order (edges lighten/grain via brightness+contrast filter, then fade) and the component returns to empty. `covering: false` resets instantly.
  - `Scene` will provide `release` via its `onReady` (Task 11 adds the prop; THIS task wires AppRoot with a temporary local `sceneReady` set by a `requestAnimationFrame` after the swap, replaced in Task 11).

- [ ] **Step 1: Implement `InkTransition.tsx`**

```tsx
import { AnimatePresence, motion } from "motion/react";
import { INTRO } from "../../../layout";

const VEILS = ["/images/intro/veil-1.png", "/images/intro/veil-2.png", "/images/intro/veil-3.png"];

// Four sweeps cover the screen with overlap; a fifth solid layer seals any mask gaps.
const STROKES = [
	{ top: "-6%", height: "34vh", rotate: -7, dir: 1, veil: VEILS[0] },
	{ top: "20%", height: "36vh", rotate: 5, dir: -1, veil: VEILS[1] },
	{ top: "46%", height: "36vh", rotate: -4, dir: 1, veil: VEILS[2] },
	{ top: "72%", height: "38vh", rotate: 8, dir: -1, veil: VEILS[0] },
];

export interface InkTransitionProps {
	/** True while the app wants the screen covered (game starting). */
	covering: boolean;
	/** True once the far side is ready — lets the ink dry out and reveal it. */
	release: boolean;
	onCovered: () => void;
}

/**
 * The lobby→duel veil: sumi strokes sweep the screen one after another until it is fully inked
 * (→ `onCovered`, the canvases swap underneath), hold, then — once `release` — each stroke "dries"
 * (edges lighten and granulate, then fades) unveiling the new scene already in motion.
 */
export const InkTransition = ({ covering, release, onCovered }: InkTransitionProps) => (
	<AnimatePresence>
		{covering && (
			<motion.div key="veil" style={{ position: "fixed", inset: 0, zIndex: 4000, pointerEvents: "none", overflow: "hidden" }} exit={{ opacity: 0 }}>
				{STROKES.map((s, i) => (
					<motion.div
						key={i}
						initial={{ x: `${s.dir * -130}vw` }}
						animate={
							release
								? { x: "0vw", opacity: 0, filter: "brightness(1.6) contrast(1.5) blur(1.5px)" }
								: { x: "0vw", opacity: 1, filter: "brightness(1) contrast(1) blur(0px)" }
						}
						transition={
							release
								? { duration: INTRO.veilDry, delay: i * INTRO.veilStrokeStagger, ease: "easeIn" }
								: { duration: INTRO.veilCover, delay: i * INTRO.veilStrokeStagger, ease: [0.3, 0, 0.2, 1] }
						}
						style={{
							position: "absolute",
							left: "-15vw",
							top: s.top,
							width: "130vw",
							height: s.height,
							rotate: s.rotate,
							background: "#17120e",
							WebkitMaskImage: `url(${s.veil})`,
							maskImage: `url(${s.veil})`,
							WebkitMaskSize: "100% 100%",
							maskSize: "100% 100%",
						}}
					/>
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

Create `index.ts`, add `export * from "./InkTransition";` to the sections barrel.

- [ ] **Step 2: Rewire `AppRoot.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { GameProvider } from "./common/state";
import { Scene, InkTransition } from "./common/components/sections";
import { useSession, Lobby } from "./common/net";
import type { EngineConfig } from "./common/game";

/**
 * Gate between the lobby and the game. The swap happens UNDER the ink veil: when the session
 * starts, strokes cover the screen (`onCovered` → the lobby unmounts, the engine mounts), the
 * veil holds until the scene has rendered a frame, then dries out over the fly-back reveal.
 * Reduced motion: no veil, no flight — the swap is immediate, as before.
 */
export const AppRoot = () => {
	const { status, mode, specials, roomKeyword } = useSession();
	const reduced = !!useReducedMotion();
	const playing = status === "playing";
	const [covered, setCovered] = useState(false);
	const [sceneReady, setSceneReady] = useState(false);

	// Leaving the game (leave / peer-left) rearms the veil for the next session.
	useEffect(() => {
		if (!playing) {
			setCovered(false);
			setSceneReady(false);
		}
	}, [playing]);

	const showGame = playing && (covered || reduced);

	const config: EngineConfig = { firstPlayer: "red", ...(mode === "online" && specials ? { specials } : {}) };
	return (
		<>
			{!showGame && <Lobby />}
			{showGame && (
				// Remount the engine per session so a new game never inherits stale state.
				<GameProvider key={`${mode}-${roomKeyword ?? "local"}`} config={config}>
					<Scene entrance={reduced ? "none" : "fly"} onReady={() => setSceneReady(true)} />
				</GameProvider>
			)}
			{!reduced && <InkTransition covering={playing} release={sceneReady} onCovered={() => setCovered(true)} />}
		</>
	);
};
```

`Scene` does not yet accept `entrance`/`onReady` — add TEMPORARY tolerant props in this task so it compiles, fully implemented in Task 11. In `Scene.tsx`:

```tsx
export interface SceneProps {
	/** "fly" = bird-view fly-back reveal on mount (Task: IntroFlight); "none" = instant (default). */
	entrance?: "fly" | "none";
	/** Fired once the canvas has produced its first frame — releases the ink veil. */
	onReady?: () => void;
}

export const Scene = ({ entrance = "none", onReady }: SceneProps) => {
```

and inside `SceneContents` add a minimal first-frame notifier (kept in Task 11):

```tsx
/** Fires `onReady` on the first rendered frame — the veil holds until the scene truly exists. */
const ReadySignal = ({ onReady }: { onReady?: () => void }) => {
	const fired = useRef(false);
	useFrame(() => {
		if (!fired.current) {
			fired.current = true;
			onReady?.();
		}
	});
	return null;
};
```

mount `<ReadySignal onReady={onReady} />` inside the Canvas (pass `onReady` down through `SceneContents`), importing `useRef` from react and `useFrame` from fiber. `entrance` is accepted but unused until Task 11 (prefix the destructured name with underscore or pass it to SceneContents and ignore — use `void entrance;` NOT allowed by lint? Simply pass it into `SceneContents` which forwards to a placeholder variable used in Task 11; to stay lint-clean, have `SceneContents` accept and ignore via `_entrance` naming is flagged too — instead have Task 10 already gate `showInterface && …` blocks on a trivially-true `entrance !== "pending"`; cleanest: implement the prop pass-through now and let Task 11 consume it. If `noUnusedParameters` complains, reference it in the ReadySignal key: `<ReadySignal key={entrance} onReady={onReady} />`).

- [ ] **Step 3: Verify**

Run: `yarn lint && yarn build && yarn test`, then `yarn dev`:
- PASSA E GIOCA → strokes sweep and cover → screen fully black → dries out revealing the game.
- In-game "leave" path (if exposed) / refresh → lobby again, veil rearmed.
- Reduced-motion emulation → instant swap, no veil.

- [ ] **Step 4: Commit**

```bash
git add src/common/components/sections/InkTransition src/common/components/sections/index.ts src/common/components/sections/Scene/Scene.tsx src/AppRoot.tsx
git commit -m "feat: multi-stroke ink veil transition wired through AppRoot"
```

---

### Task 11: Fly-back reveal (`IntroFlight`, `RevealGroup`, staged mounting)

**Files:**
- Create: `src/common/components/atoms/IntroFlight/IntroFlight.tsx`
- Create: `src/common/components/atoms/IntroFlight/index.ts`
- Create: `src/common/components/atoms/RevealGroup/RevealGroup.tsx`
- Create: `src/common/components/atoms/RevealGroup/index.ts`
- Modify: `src/common/components/atoms/index.ts`
- Modify: `src/common/components/sections/Scene/Scene.tsx`

**Interfaces:**
- Consumes: `cameraPose`, `INTRO`, `BATTLEGROUND` (Task 1), `FitCamera` `enabled` prop (Task 1).
- Produces:
  - `<IntroFlight frame={SceneFrame} onBoard={() => void} onHand={() => void} onDone={() => void} />` — owns the camera for `INTRO.flightDur` s: starts high (`+flightStartHeight` above the final y) and near (`flightStartDist × final z`), looking down at the board (`(0, BATTLEGROUND.y, 0)`), and eases position + look-target to EXACTLY `cameraPose(frame, aspect, fov)` looking at `(0, pose.y, 0)`. Fires `onBoard` at `boardRevealAt`, `onHand` at `handRevealAt`, `onDone` at the end. Recomputes the end pose live if the window resizes mid-flight.
  - `<RevealGroup drop delay>{children}</RevealGroup>` — children slide down `drop` world units into place with a soft ease on mount ("le pedine calano").

- [ ] **Step 1: Implement `IntroFlight.tsx`**

```tsx
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";
import { BATTLEGROUND, INTRO, cameraPose, type SceneFrame } from "../../../layout";

export interface IntroFlightProps {
	frame: SceneFrame;
	onBoard: () => void;
	onHand: () => void;
	onDone: () => void;
}

/**
 * One-shot bird-view fly-back on scene mount: the camera starts close above the board looking
 * down and pulls back/levels to EXACTLY the FitCamera pose (`cameraPose` — shared math, so the
 * handoff has no jump). Reveal beats (`onBoard`, `onHand`) fire along the way. Resize-safe: the
 * end pose is re-read every frame from the live size.
 */
export const IntroFlight = ({ frame, onBoard, onHand, onDone }: IntroFlightProps) => {
	const camera = useThree((s) => s.camera);
	const size = useThree((s) => s.size);
	const progress = useRef({ t: 0 });
	// Live references so mid-flight resizes re-aim the end pose without restarting the tween.
	const live = useRef({ size, frame });
	live.current = { size, frame };

	useEffect(() => {
		const beats = gsap.timeline({ defaults: { overwrite: true } });
		beats.to(progress.current, { t: 1, duration: INTRO.flightDur, ease: "power3.inOut" }, 0);
		beats.call(onBoard, undefined, INTRO.boardRevealAt);
		beats.call(onHand, undefined, INTRO.handRevealAt);
		beats.call(onDone, undefined, INTRO.flightDur);
		return () => {
			beats.kill();
		};
		// Mount-only cinematic: the callbacks are stable by construction (see Scene).
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useFrame(() => {
		if (!(camera instanceof THREE.PerspectiveCamera)) return;
		const { size: s, frame: f } = live.current;
		const end = cameraPose(f, s.width / s.height, camera.fov);
		const t = progress.current.t;
		// Start pose: near + high, staring down at the duel line.
		const startY = end.y + INTRO.flightStartHeight;
		const startZ = end.z * INTRO.flightStartDist;
		camera.position.set(0, startY + (end.y - startY) * t, startZ + (end.z - startZ) * t);
		// Look target: the board first, the frame centre at the end (level front view).
		const lookY = BATTLEGROUND.y + (end.y - BATTLEGROUND.y) * t;
		camera.lookAt(0, lookY, 0);
		camera.updateProjectionMatrix();
	});

	return null;
};
```

- [ ] **Step 2: Implement `RevealGroup.tsx`**

```tsx
import { useLayoutEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import gsap from "gsap";

export interface RevealGroupProps {
	children: ReactNode;
	/** World units the content drops from ("the pieces settle down into place"). */
	drop?: number;
	delay?: number;
}

/** Mount entrance for a cluster of scene pieces: slides down `drop` units and settles. */
export const RevealGroup = ({ children, drop = 0.35, delay = 0 }: RevealGroupProps) => {
	const group = useRef<THREE.Group>(null);
	useLayoutEffect(() => {
		const g = group.current;
		if (!g) return;
		const tween = gsap.from(g.position, { y: `+=${drop}`, duration: 0.7, delay, ease: "power3.out", overwrite: true });
		return () => {
			tween.kill();
		};
	}, [drop, delay]);
	return <group ref={group}>{children}</group>;
};
```

Create both `index.ts` files and add `export * from "./IntroFlight";` / `export * from "./RevealGroup";` to the atoms barrel.

- [ ] **Step 3: Stage the mounting in `Scene.tsx`**

Rework `SceneContents` to accept `{ showInterface, entrance, onReady }` and stage the interface:

```tsx
const SceneContents = ({ showInterface, entrance, onReady }: { showInterface: boolean; entrance: "fly" | "none"; onReady?: () => void }) => {
	const size = useThree((s) => s.size);
	const isPortrait = size.height >= size.width;
	const orientation = isPortrait ? "portrait" : "landscape";
	const landscapeFrame = useSceneFrame();
	const frame = isPortrait ? PORTRAIT_SCENE_FRAME : landscapeFrame;
	const floor = useFloorControls(orientation);
	// Fly-back reveal staging: 0 = scenery only, 1 = + board, 2 = + hand (= everything).
	// Portrait skips the flight (the bird view is designed around the landscape composition).
	const fly = entrance === "fly" && !isPortrait;
	const [stage, setStage] = useState(fly ? 0 : 2);
	const [flying, setFlying] = useState(fly);
	const showBoard = showInterface && stage >= 1;
	const showHand = showInterface && stage >= 2;
	return (
		<>
			<color attach="background" args={[PAPER]} />
			<Lights />
			<FitCamera frame={frame} enabled={!flying} />
			{flying && (
				<IntroFlight
					frame={frame}
					onBoard={() => setStage((s) => Math.max(s, 1))}
					onHand={() => setStage((s) => Math.max(s, 2))}
					onDone={() => setFlying(false)}
				/>
			)}
			<ReadySignal onReady={onReady} />
			{!isPortrait && <Stage frame={frame} />}
			<Floor frame={frame} controls={floor} orientation={orientation} />
			{showBoard && (
				<>
					<Suspense fallback={null}>
						<RevealGroup drop={fly ? 0.4 : 0}>
							<Battlefield orientation={orientation} frame={frame} floorTilt={floor.tilt} />
						</RevealGroup>
					</Suspense>
					<LandingZones frame={frame} orientation={orientation} />
				</>
			)}
			{showHand && (
				<>
					<Suspense fallback={null}>
						<Hand frame={frame} orientation={orientation} />
					</Suspense>
					<CardNameReveal frame={frame} orientation={orientation} />
				</>
			)}
		</>
	);
};
```

(The hand's own cascade entry — already built into `HandCard` — closes the sequence naturally when it mounts at `handRevealAt`.) Update the imports (`useState`, `IntroFlight`, `RevealGroup`) and `Scene`'s JSX: `<SceneContents showInterface={showInterface} entrance={entrance} onReady={onReady} />`. Keep `ReadySignal` from Task 10.

Note: the `stage` state starts at 2 for portrait and `entrance="none"` — turn passing and orientation flips NEVER re-run the staging (state initialiser only). `setStage` in gsap callbacks is async-safe (not sync-setState-in-effect, which the hooks lint forbids).

- [ ] **Step 4: Verify the handoff precisely**

Run: `yarn lint && yarn build && yarn test`, then `yarn dev`:
- Start a game (landscape): veil dries onto a HIGH close view of the empty stage; board + pawns settle in at ~0.5 s; hand cascades at ~1.5 s; the pull-back ends with NO visible jump (compare against a reload with `entrance` forced to `"none"` — final framing must be identical).
- Resize the window during the flight → no crash, flight lands on the new fit.
- Portrait emulation → no flight, interface mounts immediately (unchanged behaviour).
- Turn passing mid-game → no re-staging, no blanking (existing Suspense guarantees hold).

- [ ] **Step 5: Commit**

```bash
git add src/common/components/atoms/IntroFlight src/common/components/atoms/RevealGroup src/common/components/atoms/index.ts src/common/components/sections/Scene/Scene.tsx
git commit -m "feat: bird-view fly-back reveal with staged piece mounting on game entry"
```

---

### Task 12: Full verification pass + docs

**Files:**
- Modify: `CLAUDE.md` (architecture + gotchas)
- Possibly touched: any file with review findings

- [ ] **Step 1: Run the whole suite**

Run: `yarn lint && yarn build && yarn test`
Expected: all green.

- [ ] **Step 2: Manual end-to-end checklist (`yarn dev`)**

1. Cold load → full cinematic (paper → mountains → sun/tree/mist → leaves from the canopy drifting RIGHT → calligraphy/logo/strokes paint in). Buttons clickable as soon as visible.
2. Tap mid-cinematic on empty space → instant final state. Reload; tap PASSA E GIOCA mid-cinematic → skips AND starts the game.
3. Game entry: veil covers in strokes → dries → fly-back reveal → hand cascade → handoff with zero jump.
4. Multiplayer create → waiting (hanko keyword + net diag) → second client joins (two browser tabs) → veil + reveal on BOTH; peer-left → back to lobby (no cinematic replay), rooms still normalized.
5. Portrait (device emulation): menu centred over the panorama; game entry works (no flight, immediate interface).
6. `prefers-reduced-motion` emulated: no cinematic, minimal leaves (set `leafCount` via the reduced default if implemented, else verify the intro skip), no veil, no flight.
7. Leva folders "Lobby" (and existing ones) present, collapsed, functional; hidden in prod/touch.
8. Kill WebGL (e.g. `about:config` webgl.disabled in Firefox, or `--disable-webgl` Chromium flag) → static washi fallback + fully working menu.

Fix anything that fails; keep fixes in this task's commit unless they belong to an earlier task's file (then note it in the commit body).

- [ ] **Step 3: Update `CLAUDE.md`**

- Architecture tree: add `LobbyScene`, `InkTransition` under sections; `FallingLeaves`, `Mist`, `IntroFlight`, `RevealGroup`, `InkStrokeButton` under atoms; `leaves.ts`, `mistTexture.ts` under common; note `LOBBY`/`INTRO` in the `layout.ts` line.
- Scene & staging section: one paragraph on the lobby panorama (tree re-staged left as the leaf emitter) and the entry/exit choreography (single gsap timeline + skip; veil holds until `Scene` `onReady`; `cameraPose` shared between `FitCamera` and `IntroFlight` so the flight handoff is exact).
- Gotchas: placeholder art in `public/images/intro/` is procedural (`scripts/make_intro_placeholders.py`) — regenerate real art with the green-field pipeline and overwrite in place; stroke/veil PNGs are consumed as CSS masks (white = ink), so keep them white-on-transparent.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: lobby intro architecture, choreography and asset-pipeline notes"
```

---

## Self-review (performed while writing)

- **Spec coverage:** cinematic 4 beats → Task 7 (layers/sun/tree/mist/leaves) + Task 9 (DOM menu paint-on, skip semantics incl. button-tap = skip+action); leaves from the canopy → Tasks 2/6/7; right column + portrait centring → Tasks 8/9; hanko keyword + net diag kept → Task 9; multi-stroke veil with drying → Task 10; fly-back reveal + exact handoff → Tasks 1/11; assets incl. procedural mist/hanko → Tasks 3/5/8; WebGL fallback → Task 7; reduced motion → Tasks 9/10/11; engine untouched + pure-math tests → Tasks 1/2; Leva folders → Tasks 6/7.
- **Reduced-leaves on reduced motion:** covered via `LOBBY.leaves.reducedCount` — consumed in Task 9's `Lobby` if desired; the intro skip already satisfies the spec's hard requirement, so wiring `reducedCount` into `LobbyScene` (pass `count: reduced ? LOBBY.leaves.reducedCount : c.leafCount`) is a 1-line addition noted for Task 9 Step 1 (add `reduced` prop pass-through if implementing).
- **Type consistency:** `cameraPose(frame, aspect, fovDeg)` used identically in Tasks 1/11; `LeafFieldConfig` shape shared 2/6/7; `InkStrokeButtonProps.variant: 0|1|2` matches all Task 9 call sites; `SceneProps { entrance, onReady }` introduced Task 10, consumed Task 11; `InkTransitionProps { covering, release, onCovered }` matches AppRoot usage.
