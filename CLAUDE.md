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
  layout.ts            # ALL visual layout constants + fan math. Each Leva folder's defaults live here in ONE well-defined object: DEFAULT_SCENE_FRAME, STAGE, STAGE_LAYERS, FLOOR, BATTLEGROUND, PLAYED_CARDS, DEFAULT_FAN, LOBBY, INTRO, GAME_HUD, SEAL_DISC
  hudPalette.ts        # HUD ink palette (INK, SEAL, TEAM_INK), team/stance kanji + Italian labels, kanjiNumeral
  cardAlpha.ts         # shared rounded-corner alpha-map texture for cards
  floorTexture.ts      # alpha gradient for the duel floor (its colour map is the shared 0-base paper)
  leaves.ts            # pure leaf-field math for the lobby's falling maple leaves — deterministic per-index spawn/pose, unit-tested, no React/Three
  mistTexture.ts       # procedural paper-white fog-band texture for the lobby mist (same module-level-build idiom as floorTexture.ts)
  hooks/               # useCardTextures (+ texture preload), useCardFlip; one leva hook per folder: useSceneFrame, useFanControls, usePlayedCardControls, useBattlegroundControls, useLobbyControls
  components/
    atoms/             # Pawn, BoardLine, CardModel, LifeSeal, SealDisc, InkSplash, Lights, FitCamera, ParallaxLayer, Floor, Mist, FallingLeaves, IntroFlight, RevealGroup, InkStrokeButton, InkCanvas
    molecules/         # Card (dispatcher), MovementCard, RegularCard, HandCard, PlayerBanner, RoundMarker
    sections/          # Battlefield, Hand, GameHud, HandoffVeil, StrikeSplash, ConfirmButton, WinBanner, CardNameReveal, Stage, Scene, LobbyScene, InkLayer, InkTransition
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

- **Lobby** (`sections/LobbyScene`): the menu backdrop re-stages the same Stage art with the maple tree pulled to the LEFT edge (enlarged, nearest depth; the tree is anchored to TWO view edges via the measured `LOBBY.treeAnchor` — mass centre `LOBBY.treeEdge` inside the LEFT edge, painted base `LOBBY.treeBottom` above the BOTTOM edge, drawn ABOVE the lobby floor as true foreground — the art is a full-frame panel with the tree far bottom-left inside it, so a raw panel offset would slide it off-screen — and the leaf emitter follows the tree through `LOBBY.treeCanopyOffsetX`) as the source the falling leaves detach from — leaf motion is pure math (`leaves.ts`, deterministic per-index spawn/pose; each leaf detaches at its own staggered birth and scales in over `growSeconds`, on a field clock zeroed when the choreography releases the leaves — the field populates from an empty canopy, never switching on mid-air) rendered as GPU-instanced sprites (`atoms/FallingLeaves`) drifting right and re-entering the canopy once they cross the floor line; `atoms/Mist` (`mistTexture.ts`) drifts fog bands over the horizon. The entry cinematic is ONE gsap timeline over the Stage layer materials (paint on far → near), which then releases the leaves and hands off to the DOM menu (Framer Motion delays from `INTRO`, `InkStrokeButton` strokes slashed on by the ink shader); it's skippable at any point — `registerSkip`/`finish`, guarded by a `done` ref so it fires exactly once whether via timeline completion or a tap. On game entry, `InkTransition` slashes giant sumi strokes over the screen, swaps the lobby for `Scene` underneath on full cover (`onCovered`), and holds until `Scene`'s `onReady` (fired on the canvas's first rendered frame) sets `release` — only then do the strokes dry into bristle streaks and lift, uncovering `IntroFlight`'s bird's-eye-to-front fly-back already in motion. `IntroFlight`'s end pose and `FitCamera`'s locked pose both come from the same `cameraPose(frame, aspect, fov)`, so the handoff between them has zero jump; board (`onBoard`) and hand (`onHand`) reveals are staged partway through the flight.

### In-game HUD (DOM overlay, Italian copy)
- **GameHud**: `PlayerBanner` ×2 (team kanji 赤/青 on a carved `SealDisc` — pure-CSS raised bevelled rim, recessed face, kanji in relief; "Seal Disc" Leva folder, also used big on the HandoffVeil — name, stance 天/地, one `LifeSeal` 命 per life — cut by an ink slash when lost) + `RoundMarker` (kanji numeral in a brushed ensō, phase caption). Landscape: red top-left, blue top-right, round centred. **Portrait: both banners stack top-RIGHT** — the top pawn always stands left of the vertical line. Life/stance lag the engine by `GAME_HUD.hitLagMs` so a seal breaks when the blade lands, not at reveal. `pointer-events: none` — never steals a hand drag.
- **HandoffVeil** (pass & play only): opaque washi veil whenever the device changes hands (key `round-team`; not for round 1 red). Fully derived (lagged key + dismissed key), no setState in effects.
- **Hit feedback**: the ink burst (`InkSplash`, procedural seeded SVG + turbulence) is an `Html` on the struck pawn in `Battlefield`, on the exact attack beat (`attackBeat()` in `useResolutionControls`, shared with the pawns); `StrikeSplash` adds the screen-edge vermilion flush and the white clash flash on the same beat.
- **WinBanner**: "VINCE IL …" + a 一本 (ippon) seal stamped after the title.

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
- **Sumi ink = a TSL shader, not art** (`src/common/ink/`). Style target: action sumi-e (haboku/hatsuboku) — fast dry-brush slashes, solid black head splitting into bristle streaks (kasure) toward the tip/flanks, flung droplets, pale wash beside the black. Each effect is a BRUSH STROKE in its own frame (`s` along the gesture, `n` across): pressure profile → bristle noise in `n` stretched along `s` → ink load falling along `s`/`|n|` vs paper tooth → droplets on an anisotropic cell grid → wash whose edge alone evolves with `time` (dry-brush marks stay put). Rendered by `WebGPURenderer` (WebGPU, falls back to WebGL2 — TSL compiles to both) in dedicated transparent canvases (`atoms/InkCanvas`, ortho, 1 unit = 1 CSS px); the game/lobby scenes stay on WebGL. **Buttons — every button in the app is an `InkStrokeButton`** (a two-option choice is ONE stroke: `InkSegmentedStroke`, whose selected half takes its tone while the other goes ghost — `segment` on the registry entry, `segOn/segActive` uniforms) (lobby menu AND the duel's `ConfirmButton`): it only REGISTERS its element in `ink/inkRegistry` (external store); `sections/InkLayer` draws one stroke per entry (lobby: between `LobbyScene` and the column, by DOM order; duel: mounted in `Scene` at `zIndex` 1450, just under the button overlay), re-reading the button rect + effective DOM opacity every frame; labels stay DOM on top. **Veil**: `InkTransition` = 6 giant combed slashes (`veilStrokes`, pure + coverage-tested) + a closing flood → `onCovered`; on release it dries into streaks and UNMOUNTS. Look params are shared live uniforms (`INK_LOOK`, "Ink" Leva folder, defaults `INK` in layout.ts). Uniforms are mutated in `useFrame` via the mesh ref (`inkUniforms(material)`), never via `useMemo` values (react-hooks immutability rule). No WebGPU/WebGL2 → CSS stand-ins. The old mask PNGs in `public/images/intro/` (`stroke-*`, `veil-*`, `wipe-*`) and `scripts/ink_masks.py` are no longer used at runtime.
- **Framer Motion owns `transform` on animated elements**: once a `motion.*` element animates any transform-adjacent value (`x`, `scale`, `rotate`, …) via `animate`/`variants`, Framer Motion takes over the whole `transform` string on every render — a plain `style.transform` STRING on the same element is silently discarded. Put every transform component that needs a fixed value inside the animated value set too (see `InkStrokeButton`'s hanko seal: `rotate: -6` lives in `variants`, not `style`). Exception: independent transform props passed directly in `style` (`rotate`, `x`, `y`, `scale`, …) ARE picked up as Motion-managed values and compose fine alongside `animate`/`variants` targets on the same element (see `InkTransition`'s stroke `style.rotate` coexisting with its animated `x`). Related gotcha: a changed `transition.delay` never restarts a Motion animation that is already pending, and re-resolving the same variant to identical targets is a no-op (`protectedKeys`) — so the lobby menu's paint-on is STATE-driven (Lobby's `beat` counter flips each element hidden → painted, a target-changing switch), not delay-scheduled.
- **Online mode & TURN**: multiplayer is Trystero P2P (WebRTC, Nostr signaling) owned by `src/common/net/SessionProvider.tsx`. PC↔mobile needs a TURN relay (carrier CGNAT blocks direct paths). Credentials are short-lived Cloudflare ones minted by `api/turn-credentials.ts` — a Vercel serverless function (works in this Vite project without Next; env `TURN_KEY_ID` + `TURN_KEY_API_TOKEN`, server-side only, never `VITE_*`). Client resolution chain in `src/common/net/iceServers.ts`: `VITE_ICE_SERVERS` override → `/api/turn-credentials` (cached until near TTL) → static `VITE_TURN_*` → STUN-only. `yarn dev` does NOT serve `/api` — test TURN locally with `vercel dev` or the `VITE_*` fallbacks in `.env.local`. Signaling relays are **pinned** (`RELAY_URLS` in SessionProvider): Trystero's hash-sampled defaults often land on flaky community relays whose sockets open but drop events. Connection health (relay count, TURN source, ICE state via a wrapped `RTCPeerConnection`) is shown on-screen in the lobby waiting panel (`net/diagnostics.ts`) because mobile has no console. Room keywords are **normalized (trim+lowercase) in SessionProvider**: the topic hash is case-sensitive, mobile keyboards auto-capitalize, and the display font renders everything uppercase so the mismatch is invisible.

## Testing

`game/engine.test.ts` exercises the rulebook (movement priority, the meet-in-the-middle example, stance/feint, clash, counter, win condition, end-of-round card rotation). The engine is pure, so add a test there for any rule change before touching the UI.
