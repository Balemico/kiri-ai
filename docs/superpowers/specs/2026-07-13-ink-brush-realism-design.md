# Ink Brush Realism — Design

**Date:** 2026-07-13
**Scope:** `InkStrokeButton` (lobby menu strokes), `InkTransition` (lobby→duel veil), intro asset pipeline.

## Goal

Replace the soft, obviously-procedural brush strokes behind the lobby buttons and in the page
transition with rough, realistic sumi ink — ragged bristle edges, flying white (dry gaps),
variable ink density — matching a real dry-brush reference. Additionally, the stroke must be
**seen being drawn**: the paint-on reveals the stroke progressively along its own length with a
ragged brush-tip frontier, not a straight clip edge; the transition veils are likewise *drawn*
onto the screen instead of sliding in.

No WebGL/shader work: both components stay DOM + Framer Motion, driven by CSS `mask-image`.
Realism comes from the assets (alpha = ink density) and from frame-sequence masks for motion.

## Current state

- `InkStrokeButton.tsx`: colour fill masked by `stroke-{1..3}.png` (1024×224), paint-on via
  `clipPath: inset(0 100% 0 0) → inset(0 0% 0 0)` — a perfectly straight reveal edge.
- `InkTransition.tsx`: 4 full-width sweeps masked by `veil-{1..3}.png` (2048×640), covering by
  sliding in on `x`, drying out via `brightness/contrast/blur` + fade.
- All 6 PNGs are procedural placeholders from `scripts/make_intro_placeholders.py` (blurred
  ellipse stacks — the reason the effect reads as fake).
- CSS masks use the **alpha channel**; per CLAUDE.md the PNGs must stay white-on-transparent
  and be overwritten in place (same filenames) when real art lands.

## 1. Asset generation: black ink on white paper (not green-field)

The Stage art needed green-field keying because it is coloured. Brush strokes are monochrome,
so the generation pipeline differs:

- Generate each stroke with Nano Banana as **black sumi ink on plain white paper** — the most
  natural subject for the model, maximum texture quality (bristle streaks, splatter, dilution).
- Convert **luminance → alpha**: white paper → transparent, solid black → opaque, diluted-ink
  greys → semi-transparent. This *preserves* ink-density gradation that a chroma key would
  flatten. Output RGB is forced to white (masks read alpha only; white kept per CLAUDE.md).
- Formats: 3 button strokes ~1024×224, horizontal, tail tapering to the right (the hanko seal
  sits on the tail); 3 veils ~2048×640, fuller coverage, still ragged top/bottom edges.
- Generated sources live in `public/images/intro/src/` (gitignored or committed — committed,
  matching how `backgroud/` keeps its sources); processed masks overwrite the canonical
  filenames in `public/images/intro/`.

## 2. New script: `scripts/ink_masks.py`

Sits beside `cutout_layers.py`. Reads the generated sources and produces:

1. **Final masks** — luminance inversion → alpha, levels adjustment (clip near-white paper
   noise to fully transparent, deepen solid ink), small-speckle cleanup. Overwrites
   `stroke-{1..3}.png` and `veil-{1..3}.png` in place.
2. **Progressive paint frames** — per stroke *and* per veil, ~12 frames of the same stroke
   revealed along its length: frame *k* keeps pixels whose "progress coordinate" (x position
   perturbed by low-frequency noise) is below k/12. The noisy threshold makes the advancing
   frontier ragged and slightly translucent, like a loaded brush tip. Naming:
   `stroke-1-f01.png … stroke-1-f12.png`, `veil-1-f01.png …`.
   - Button frames at full mask resolution (1024×224; ~10 KB each).
   - Veil frames at **half resolution** (~1024×320): 3 veils × 12 full-res RGBA frames would
     cost ~120 MB decoded on mobile; half-res is ~30 MB and invisible for a soft ink mask.
3. **Eroded "dry" veil variants** — `veil-{1..3}-dry.png`: the veil pushed through a
   noise-modulated threshold that eats the thin/translucent regions first, leaving a granular
   dry-brush skeleton. Used by the transition's release phase.

The script must be deterministic (fixed seed) so regenerating art doesn't churn frames.

## 3. `InkStrokeButton`: frame-sequence paint-on

- Replace the `clipPath` reveal with the 12-frame sequence. A Motion value animates 0→1 over
  ~0.55 s (same easing family as now); the frame index derives from it.
- **Micro-crossfade between consecutive frames**: two stacked mask layers (frame *k* fading
  out, frame *k+1* fading in) so 12 steps read as one continuous stroke, not a 15 fps flipbook.
- Stays **state-driven on `visible`** exactly as today (the intro-skip contract): flipping
  `visible` starts/fast-forwards the sequence; the `done`-style guarantees are unchanged.
  Respect the existing Motion gotchas (no delay-rescheduling; target-changing switches).
- All frames for all 3 variants are **preloaded** (module-level `new Image()` warm-up) so the
  first paint-on never flashes an unloaded mask.
- Hover "bleed", tap scale, label, and seal behaviour unchanged.

## 4. `InkTransition`: veils are drawn, then dry

- **Covering**: each sweep switches from slide-in to **paint-on frames** (its 12 half-res
  frames), keeping the existing per-stroke stagger. A **residual drag of ~10vw** remains on
  `x` while the frames play — the stroke is drawn *by a moving wrist*, not stamped in place
  (pure static paint-on reads as a progress bar at this size). Cover timing/stagger constants
  stay in `layout.ts` (`INTRO`).
- The solid "seal" layer and `onCovered` timing contract are unchanged.
- **Release (dry-out)**: on top of the existing brightness curve, each veil cross-fades to its
  `-dry` eroded variant (opacity only — no runtime `feTurbulence`, which is a full-screen
  filter risk on mobile), then fades out. The ink visibly granulates as it dries.

## 5. Dev placeholders upgraded (verifiability now)

`make_intro_placeholders.py`'s `brush_stroke()` is upgraded to produce genuinely rough strokes
(noisy edges, bristle streaks, splatter, flying white) so the entire pipeline — `ink_masks.py`,
frames, crossfade, veil paint-on, dry variants — is built and visually verified **before** the
Nano Banana art exists. Real art later just lands in `public/images/intro/src/` and
`ink_masks.py` re-runs; no code changes.

## Out of scope

- Hover/tap interactions (unchanged), calligraphy.png and leaf-1.png (separate placeholders),
  any WebGL/shader work, Stage/floor art.

## Verification

- `yarn lint`, `yarn build`, `yarn test` stay green (no engine changes expected).
- Visual: dev-server walkthrough — lobby intro paint-on (plus skip-tap fast-forward), hover
  bleed, PASSA E GIOCA → veil cover → dry-out reveal, on desktop width and a narrow viewport.
- `ink_masks.py` run twice produces byte-identical output (determinism).
