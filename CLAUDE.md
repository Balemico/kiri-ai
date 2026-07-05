# Kiri-ai — Project Guide

Digital version of **Kiri-ai: The Duel**, a 2-player samurai dueling card game, rendered in 3D with React Three Fiber. Current mode: **pass & play** on one device (turns driven by on-screen buttons). Designed so an async/multiplayer mode can be added later on top of the pure engine.

## Commands

```bash
yarn dev          # Vite dev server
yarn build        # tsc -b && vite build
yarn lint         # eslint (must stay clean)
yarn test         # vitest run — pure game-engine tests
yarn test:watch   # vitest watch
```

Stack: React 19, TypeScript 6, Vite 8 (rolldown), three 0.184 + @react-three/fiber 9 + drei, gsap (animations), leva (debug controls), vitest.

## Architecture

Strict separation between **pure game logic** (no React/Three) and **rendering**.

```
src/common/
  game/                # PURE engine — no React, no Three, fully unit-tested
    types.ts           # Stance, Team, Side, Slot, CardDef, PlayerState, GameState, GameAction, ActionResolution
    cards.ts           # CARD_DEFS, getCardDef, getEffect, distributeSpecials
    rules.ts           # board geometry (spaceToX), movementPriority, resolveAction (movement→attacks→damage)
    engine.ts          # createInitialState + reducer(state, action)
    engine.test.ts     # vitest suite covering the rulebook
  state/               # React binding over the engine
    GameProvider.tsx   # useReducer(reducer); exposes { state, dispatch }
    useGame.ts         # context hook
    selectors.ts       # derives CardView[] for rendering (faceUp / interactive / location) — NO string parsing in components
  layout.ts            # ALL visual layout constants + fan math. Each Leva folder's defaults live here in ONE well-defined object: DEFAULT_SCENE_FRAME, STAGE, STAGE_LAYERS, FLOOR, BATTLEGROUND, PLAYED_CARDS, DEFAULT_FAN
  cardAlpha.ts         # shared rounded-corner alpha-map texture for cards
  floorTexture.ts      # alpha gradient for the duel floor (its colour map is the shared 0-base paper)
  hooks/               # useCardTextures (+ texture preload), useCardFlip; one leva hook per folder: useSceneFrame, useFanControls, usePlayedCardControls, useBattlegroundControls
  components/
    atoms/             # Pawn, BoardLine, CardModel, HudButton, Lights, FitCamera, ParallaxLayer, Floor
    molecules/         # Card (dispatcher), MovementCard, RegularCard, HandCard, HudPanel
    sections/          # Battlefield, Hand, TurnHud, CombatToast, Stage, Scene
App.tsx                # <GameProvider><Scene/></GameProvider>
main.tsx               # createRoot — NO StrictMode (see Gotchas)
```

Component hierarchy is by complexity: **atoms** (dumb primitives) → **molecules** (compose atoms + interaction) → **sections** (wired to game state). Molecules must not import from sections.

### Data model (no fragile string IDs)
A card is typed data, never a `team-card:side` string. The engine state holds `PlacedCard { cardId, side, revealed }`; rendering reads `CardView` objects from `selectors.ts`. The board is 5 spaces (index 0–4); red starts at 0, blue at 4; `spaceToX` maps index → world x.

### Scene & 3D staging (background + floor + interface)
`Scene` locks a **level front camera** (no orbit; `FitCamera` dollies on z to keep `SceneFrame` framed at any width), so the view is composed as flat, painter-ordered layers:

```
scenery (Stage, renderOrder −100…) → floor (renderOrder −10) → pieces (board/pawns z≈0) → cards (always-on-top)
```

- **Stage** (`sections/Stage` + `atoms/ParallaxLayer`): a sumi-e backdrop = full-frame PNG layers (`STAGE_LAYERS`) over the shared paper plate `0-base.jpeg`, fitted to the **top half** above the horizon (`HORIZON_FRACTION`). Layers keep NATIVE aspect (no stretch); each layer's `y` pulls the elements together so they all fit; depth = differential pointer-parallax + idle drift (faked, NOT real z-separation). Width is sized from the real visible width (`frameViewport`), NOT `frame.halfWidth` (which tracks the gameplay cluster and shrinks with the cards).
- **Floor** (`atoms/Floor`): the **bottom half** — the same `0-base` paper as a plane raked toward the camera (`tilt`), its far edge faded into the horizon via `floorTexture`'s alphaMap; it masks the scenery below the horizon.
- **Background art assets**: `public/images/backgroud/` (note the typo dir). `0-base.jpeg` = plain washi paper (backdrop base AND floor map); `1-sun` / `2-far-mountain` / `3-middle-mountain` / `4-near-mountain` / `4-tree` = transparent PNG elements. They were chroma-keyed from AI output by `scripts/cutout_layers.py` — Nano Banana fakes "transparency" as a baked checkerboard, so generate each element on a **solid green field** and key it out (never a checkerboard / never JPEG, which has no alpha).
- **Battleground** (`Battlefield` + `BoardLine`): board line + pawns, positioned by `BATTLEGROUND { x, y }`. The line is **pure white** (`meshBasicMaterial`, `toneMapped:false`); the diamond markers are **raked onto the floor** (`diamondTilt` — match it to the floor `tilt`).

All scenery/floor meshes are **unlit** (`meshBasicMaterial`, `toneMapped:false`) so the painted colours stay exact regardless of `Lights`. `<Stage/>` + `<Floor/>` render even with the interface off (`Game UI → showInterface`).

## Game rules (as implemented in `rules.ts`)

Each round: both players place 2 cards face-down (`first` = closest to opponent = action 1, `second` = action 2), then reveal/resolve first, then second, then end-of-round.

**Action resolution order** (both reveal one card in the same slot):
1. **Movement before attacks.** Priority = `(stance==heaven ? +100 : 0) + typeRank`, with typeRank Charge(3) > Approach/Retreat(2) > Change-Stance(1). Higher priority moves first; cannot pass the opponent (stops on their space); equal priority = simultaneous "meet in the middle" splitting the gap (`floor(gap/2)`, matches rulebook Example 1). Change-Stance rotates the pawn without moving.
2. **Attacks** (simultaneous). Hit if attacker's stance ∈ card stances AND opponent sits on a target space (`attacker.space ± distance`). Wrong stance/out of range = feint. Both hit → **clash**, no damage. Kesa/Zan-Tetsu auto-switch stance after a valid attack.
3. **Counterattack** cancels the opponent's successful hit and deals damage; no-op if the opponent didn't hit.
4. **Damage**: 2 hits defeat a player → `phase: "game-over"`, `winner` set. Life shown = 2 − damage.

**End of round** (`END_ROUND`): first card returns to hand; second card is set aside for one round; the previously set-aside card returns; played specials are discarded (out of game); a special played second sets nothing aside that round.

Turn phases: `red-place → blue-place → ready → reveal-first → reveal-second → round-end → (next) | game-over`.

## Conventions

- **Leva controls**: every component/feature gets its **own named folder, collapsed by default** — `useControls("Name", schema, { collapsed: true })` — and its defaults come from **ONE well-defined object in `layout.ts`**, never scattered constants (e.g. `STAGE`, `FLOOR`, `BATTLEGROUND`, `PLAYED_CARDS`, `DEFAULT_FAN`, `DEFAULT_SCENE_FRAME`). The global `<Leva collapsed />` lives in `Scene`.
- **Layout constants** live only in `layout.ts` (zones, scales, fan geometry, offsets, scene-staging objects). `spaceToX` stays in `game/rules` because it's tied to the rules.
- **Card visibility** (face up/down, interactive) is decided centrally in `selectors.ts`, never re-derived inside card components.
- Keep `yarn lint`, `yarn build`, and `yarn test` green before considering work done.

## Gotchas / lessons learned

- **No React StrictMode** (`main.tsx`): its dev double-mount restarts the imperative gsap card animations mid-flight, causing a visible hitch in the hand cascade. All HandCard tweens also use `overwrite: true` so a mid-flight re-render replaces tweens instead of stacking them.
- **eslint-plugin-react-hooks 7.x is strict**: it forbids synchronous `setState` inside effects and reading `ref.current` during render. Prefer derived values, capture mount-only props in a ref, use `useMemo` for objects read during render, and remount-by-key for transient UI (see `CombatToast`).
- **Material disposal**: materials created with `new THREE.Material(...)` and passed via the `material={}` prop are NOT auto-disposed by R3F. Per-card materials are `dispose()`-d on unmount (`useCardTextures`, `MovementCard`); the invisible hit material is a single shared module constant (`RegularCard`).
- **Rounded card corners** come from a shared alpha-map cutout (`cardAlpha.ts`, `alphaTest` on faces, `alphaMap` on overlays), not from the GLB. Tune `RADIUS` there.
- **eslint flat config**: use `reactHooks.configs.flat.recommended` (not the legacy `recommended-latest`, whose `plugins` is a string array).
- The hand fan uses a fixed per-card step (`DEFAULT_FAN.cardStep`) for a tight, overlapping look; it's anchored to the bottom of the viewport (derived from `SceneFrame` + aspect via `frameViewport`, not R3F's lagged cached viewport) and only shrinks if it would overflow a narrow screen.
- **Cards are always-on-top**: opaque cards lose the depth test to a nearer *transparent* mesh (e.g. a floor pushed forward in z), because opaque renders before transparent. So `HandCard` makes every card mesh ignore depth (`depthTest:false`, `transparent:true`) and draw last (`renderOrder = 100 + z·100`, per-card so the fan still stacks right) — cards then sit above scenery/floor whatever the floor's z.
- **Turn change must not "reload"**: a shared Suspense fallback blanks everything inside it while new textures load. So card textures for **both teams** are preloaded (`useCardTextures` module-level `useLoader.preload`), and `Battlefield` / `Hand` have **separate** Suspense boundaries — passing the turn never suspends or blanks the scene.
- **Hand entry & exit animations**: `HandCard` cascades in (`entry`, rises from below) and out (`exit`, slides down off-screen). Exit needs a **presence layer** in `Hand`: cards that leave the fan *without* moving to a slot stay mounted as "ghosts" (mounted at their last transform) until their down-tween finishes, then are dropped via async timers — same lint-safe pattern as `CombatToast`.

## Testing

`game/engine.test.ts` exercises the rulebook (movement priority, the meet-in-the-middle example, stance/feint, clash, counter, win condition, end-of-round card rotation). The engine is pure, so add a test there for any rule change before touching the UI.
