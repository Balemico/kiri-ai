# Nano Banana prompts — sumi ink strokes (lobby buttons + transition veils)

Generate each image as **black sumi ink on plain white paper** (NOT green-field, NOT
transparent, NOT checkerboard): the pipeline converts luminance → alpha, so diluted-ink
greys become real semi-transparency (flying white, dry-brush streaks survive intact).

Workflow:
1. Generate with the prompts below (any size ≥ the target; the script resizes).
2. Save as `public/images/intro/src/<name>.png` (or .jpg) — names: `stroke-1..3`, `veil-1..3`.
3. Run `python3 scripts/ink_masks.py` — it overwrites the canonical masks and regenerates
   the `wipe-N.png` reveal ramps and the `-dry` veil variants. No code changes needed.
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
