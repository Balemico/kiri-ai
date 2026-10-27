// Single source of truth for the scene's visual layout (zones, fan, board offsets).
// Pure geometry — no React, no Three. The board space → x mapping lives in game/rules
// (spaceToX) because it is tied to the rules; everything purely visual lives here.

import { spaceToX, BOARD_SPACES, RED_START, BLUE_START, type Slot, type Team } from "./game";

export interface Vec3 {
	x: number;
	y: number;
	z: number;
}

// --- Battlefield ---
// The duel stands on the floor: the board sits below the horizon, in the lower/floor half, so
// the pawns read as standing on the ground. Its position is tunable in the "Battleground" Leva
// folder (single source for it); the hand is below it and the drop zones to the sides.
// Each orientation-dependent family (Battleground, Hand Fan, Played Cards, Floor) carries BOTH its
// landscape and its portrait knobs in one object; the Leva folder shows them under Landscape /
// Portrait sub-folders (see useOrientationFolder) and the scene reads the active orientation's set.
// Portrait (vertical) layout: the background is dropped, the floor fills the screen, and the duel
// line runs VERTICALLY (bottom = near, top = far). The turn player sits at the bottom with its pawn
// + marker to the RIGHT of the line; the opponent at the top, to the LEFT.
export const BATTLEGROUND = {
	// Landscape: the horizontal board line + pawns on the floor band.
	x: 0, // horizontal shift of the whole board
	y: -0.7, // vertical placement (below the horizon, on the floor)
	diamondTilt: 1.0, // rake the diamond markers onto the floor (radians) — match to the floor tilt
	sharedOffset: 0.2, // lateral nudge each pawn gets when both share a space, so they stay readable
	// Portrait: the vertical duel line, raked onto the floor, with pawns/markers to its sides.
	baseY: 0.66, // world-Y centre of the vertical line
	laneOffset: 0.5, // lateral (x) offset of a pawn/marker from the line — bottom team right (+), top left (−)
	pawnLift: -0.7, // extra world-Y nudge of the pawns only, to seat their feet on the diamonds
	thickness: 1, // fine-tune multiplier on the (auto, line-proportional) marker/diamond/line-width size — same in both orientations; 1 = the natural proportion
	handReserve: 0.38, // fraction of the viewport HEIGHT kept for the hand at the bottom; the line fills the rest
	margin: 0.06, // extra breathing room (fraction of the viewport HEIGHT) kept free, so the line never fills edge-to-edge
} as const;

/** Viewport orientation — selected at runtime (portrait = window taller than wide). */
export type Orientation = "portrait" | "landscape";

/** Which lateral side a team's pawn/marker sits in portrait: the bottom team is on the right (+). */
export const portraitLateralSign = (team: Team, bottomTeam: Team): number => (team === bottomTeam ? 1 : -1);

/** Natural span of the duel line (outermost spaces), used to scale `lineCoord` to any line length. */
const PORTRAIT_LINE_SPAN = spaceToX(BOARD_SPACES - 1) * 2;

/**
 * A board space's position ALONG the vertical line (portrait), as a world-Y coordinate. The
 * `spaceToX` scalar (−1.5 … +1.5) is reused as Y, signed so the bottom team's start sits at the
 * bottom: bottomTeam red → space 0 at −1.5 (bottom), space 4 at +1.5 (top); blue flips the signs.
 * Scaled to `lineLength` so the spaces spread to fill the line (the outer spaces land on its ends),
 * keeping the diamonds and pawns in step as the line is stretched.
 */
export const lineCoord = (space: number, bottomTeam: Team, lineLength: number = PORTRAIT_LINE_SPAN): number =>
	(bottomTeam === "red" ? 1 : -1) * spaceToX(space) * (lineLength / PORTRAIT_LINE_SPAN);

/**
 * Portrait: lay a line coordinate `t` onto the raked board plane (tilted around X by `tilt`, to
 * match the floor) so the vertical duel line recedes in perspective — points further up the line
 * sit a touch higher (`y`, foreshortened by cos) and further away (`z`, by sin, away from the
 * camera at +z). The upright pieces (pawns, marker diamonds) are placed at this (y, z); the floor
 * supplies the ground, this puts the line + pawns on it. `baseZ` is the board's own z plane.
 */
export const rakeLine = (t: number, tilt: number, baseY: number = BATTLEGROUND.baseY, baseZ = 0): { y: number; z: number } => ({
	y: baseY + t * Math.cos(tilt),
	z: baseZ - t * Math.sin(tilt),
});

/**
 * Portrait line length: the line fills the viewport HEIGHT minus the hand reserve at the bottom and a
 * breathing `margin` (both fractions of the visible height). Divided by cos(tilt) so that AFTER the
 * rake the line's vertical (world-Y) span equals (1 − handReserve − margin) of the visible height.
 */
export const portraitLineLength = (viewportHeight: number, handReserve: number, margin: number, tilt: number): number =>
	(viewportHeight * Math.max(0, 1 - handReserve - margin)) / Math.cos(tilt);

// --- Victory banner ---
// The "RED/BLUE WINS" title overlay shown on game-over: a brush stroke sweeps in, then the
// words appear one by one. `testVictory`/`testTeam` force it on (without winning) to tune in Leva.
export const WIN_BANNER = {
	offsetTop: 0.2, // vertical position from the top, as a fraction of viewport height
	fontScale: 0.5, // multiplier on the base display size (1 = Typography "display")
	inkColor: "#0a0a0a", // brush-stroke ink colour
	spreadSeconds: 1.1, // time for the brush to sweep across, before the words appear
	letterStagger: 0.06, // delay between each letter STARTING (< letterDuration → letters overlap)
	letterDuration: 0.4, // how long each letter takes to fade/rise in
	testVictory: false, // Leva: show the banner without a real winner
	testTeam: "red" as Team, // Leva: which team's victory to preview
} as const;

// --- In-game HUD ---
// The DOM overlay drawn over the duel: the two player banners (life seals + stance), the round
// marker, the pass-the-device veil (pass & play) and the ink splash on a landed hit.
export const GAME_HUD = {
	inset: 22, // px from the screen edges to the banners / round marker
	scale: 1, // landscape size multiplier for banners + round marker
	portraitScale: 0.74, // portrait size multiplier (the top strip is narrow)
	handoffDelayMs: 650, // after a confirm, let the cards flip face-down before the veil inks in
	hitLagMs: 450, // a life seal breaks this long after the reveal, once the blade has landed
	splashScale: 1, // size multiplier for the hit ink splash
	splashSeconds: 1.6, // how long the splash lingers before it fades
} as const;

// The samurai pawns are flat billboard sprites (white silhouettes in public/images/characters,
// tinted per team). One PNG per stance: heaven = sword raised high, earth = sword forward.
// `frames` holds metrics measured from each PNG's alpha so the figure is anchored by its BODY
// and FEET (not the image centre) — the earth frame is wider because the sword extends sideways,
// so without this the samurai would jump horizontally when switching stance.
export const PAWN = {
	height: 1.0, // world height of the sprite (board line → top of frame)
	yLift: 0.11, // nudge the feet relative to the board line
	z: -0.2, // just in front of the board line
	// Draw order: pawns sit ABOVE the played cards + their landing zones (renderOrder ~127) but BELOW the
	// hand fan (see HAND_RENDER_BIAS), so the figures aren't hidden by the committed cards while the hand
	// still stays on top of everything. Slash/clash effects are bumped to stay above the pawn. (Pairs with
	// depthTest:false on the sprite material.)
	renderOrder: 135,
	frames: {
		// aspect = imgW/imgH; bodyCol = leg-mass x (0..1 from left); feetRow = lowest opaque row (0..1 from top).
		// `scale` multiplies `height` per stance: the earth pose reads bigger (wide stance + extended sword),
		// so the heaven pose is bumped up a touch to match it visually.
		heaven: { aspect: 1024 / 1536, bodyCol: 0.451, feetRow: 0.956, scale: 1.12 },
		earth: { aspect: 1641 / 1536, bodyCol: 0.338, feetRow: 0.933, scale: 1.0 },
	},
} as const;

// Yellow sword-cut wedge shown over a pawn that takes a hit (echoes the card slash). A bold
// triangle (tip + base, sized as a fraction of pawn height) that sweeps along its length and
// fades. Single source for the "Slash" Leva folder.
export const SLASH = {
	color: "#e8b93f",
	angle: 0.9, // radians; bottom-left → top-right like the card art
	lengthScale: 0.94, // tip→base length, × pawn height
	widthScale: 0.1, // base width, × pawn height
	opacity: 0.95, // peak opacity
	baseFade: 0.25, // how much the base end fades out (0 = solid base, 1 = fully transparent base)
	inDur: 0.16, // fade-in seconds
	growDur: 0.25, // birth: seconds for the wedge to grow from tip to base
	outDur: 0.2, // fade-out seconds
} as const;

// --- Clash (parry) ---
// When both attacks land they cancel and deal no damage. Instead of a per-pawn cut, two YELLOW blades
// (the same sword-cut as the strikes) CROSS to form an X, meeting up high above the duellists' midpoint.
// They reuse the look from SLASH (colour, size, durations); these knobs set the X's angle, size and how
// high it sits. Single source for the "Clash" Leva folder.
export interface ClashConfig {
	tilt: number; // radians; each blade's lean from vertical — together they form the X (~0.6 ≈ a wide X)
	sizeScale: number; // blade length/width relative to the pawn sword-cut
	yLift: number; // raise the crossing point above the pawns' chest height (so the X meets up high)
	hold: number; // seconds the X stays crossed before fading
}
export const CLASH: ClashConfig = {
	tilt: 0.93,
	sizeScale: 0.85,
	yLift: 0.4,
	hold: 0.18,
};

// --- Action resolution timing ---
// The engine resolves an action atomically, but the rulebook orders it: movement by priority
// (Heaven first, then Charge > Approach/Retreat > Change-Stance) THEN simultaneous attacks. So the
// animation plays it in beats — the higher-priority mover slides first, the lower-priority mover
// follows after `moveStagger`, and once movement settles the attacks land after `attackGap`. Equal
// priority → both slide together (stagger skipped). Single source for the "Resolution" Leva folder.
export interface ResolutionConfig {
	moveDur: number; // seconds for one pawn's slide along the line
	moveStagger: number; // delay before the lower-priority pawn starts its slide
	attackGap: number; // pause between the last movement settling and the attack landing
}
export const RESOLUTION: ResolutionConfig = {
	moveDur: 0.6,
	moveStagger: 0.5,
	attackGap: 0.15,
};

// --- Audio ---
// Defaults for the "Game Audio" Leva folder. The sound files + playback live in src/common/audio.ts;
// these are just the tunable knobs (single source, mirroring every other Leva folder).
export const AUDIO = {
	muted: false,
	volume: 0.7,
} as const;

export const PAPER = "#f4eee0"; // washi cream — scene background behind the panels
// The screen splits at the horizon (half the page): the background occupies the top half,
// the floor the bottom half. (Fraction measured down from the top of the framed view.)
export const HORIZON_FRACTION = 0.4;

// --- Duel floor (tilted neutral-paper ground, separate from the background Stage) ---
// The locked camera is level, so a flat floor would be edge-on/invisible: this plane is
// raked toward the camera so its surface reads. It is plain washi paper — light and neutral,
// darkening only slightly toward the camera — and its far edge dissolves into the horizon
// mist. It fills the lower half (its top edge meets the horizon); the pawns stand on it.
export const FLOOR = {
	tilt: 1.5, // radians; 0 = vertical band facing camera, higher = laid further back
	yNudge: -0.3,
	z: 0.9,
	widthScale: 2.5, // multiple of frame width (covers the screen as ground)
	tint: 0.92, // multiplies the paper map — slightly darker so the floor reads as its own plane
	opacity: 1,

	overscan: 1.25, // size past the band so the tilt never leaves a gap at the edges
} as const;

// Portrait floor defaults: the floor fills the whole screen (no background), so it reads better
// with a gentler rake and a tighter width than the landscape lower-band floor. The board pieces
// (line, diamonds, markers, pawns) follow THIS tilt so they sit on the same receding plane.
export const FLOOR_PORTRAIT = {
	...FLOOR,
	tilt: 1.05,
	widthScale: 1.7,
} as const;

// --- Background stage (parallax sumi-e panels in the top half) ---
// The scenery is the full painting fitted into the strip above the horizon. Panels keep their
// NATIVE aspect (width = height × imageAspect) so nothing is stretched — fitting the whole
// painting by height into the (shorter) top half is what compresses the distances between the
// elements, not their shapes. They share one size/position so the painting stays registered;
// depth is differential pointer-parallax + a slow idle drift, NOT real z-separation. Unlit
// (meshBasic) so the painted colours stay exact regardless of Lights.
export const STAGE = {
	scale: 0.84,
	lift: 0.25, // default upward nudge for the scenery cluster (per-layer `y` does the fine placing)
	/** Max pointer-driven offset (world units) at depth = 1 (the nearest layer). */
	parallaxX: 0.1,
	parallaxY: 0.01,
	/** Idle drift: amplitude (world units) and speed (rad/s) at depth = 1. */
	driftAmp: 0.3,
	driftSpeed: 0.065,
	imageAspect: 2752 / 1536, // source layer dimensions — keep panels undistorted
	planeZ: -0.1,
	widthOverscan: 1.2, // cover the full width with margin so parallax never bares an edge
} as const;

/** A parallax panel. `depth` scales both parallax and drift (0 = far/still, 1 = near/most). */
export interface StageLayer {
	url: string;
	depth: number;
	phase: number;
	/** Vertical offset (world units) to pull this element toward the others — keeps proportions. */
	y?: number;
}

/** Shared washi-paper plate — the backdrop base AND the floor's colour map. */
export const STAGE_BASE_URL = "/images/backgroud/0-base.jpeg";

/** Layers far → near (paint order). All share STAGE's size/position. */
// `y` pulls each element toward the cluster (the painting's native gaps are too tall to show at
// once): the sun comes down a lot, the mountains a little, the tree barely — proportions intact.
export const STAGE_LAYERS: StageLayer[] = [
	{ url: STAGE_BASE_URL, depth: 0.0, phase: 0, y: 0 }, // paper plate (static, full cover)
	{ url: "/images/backgroud/1-sun.png", depth: 0.1, phase: 1.1, y: -0.75 },
	{ url: "/images/backgroud/2-far-mountain.png", depth: 0.18, phase: 2.0, y: -0.7 },
	{ url: "/images/backgroud/3-middle-mountain.png", depth: 0.28, phase: 3.1, y: -0.65 },
	{ url: "/images/backgroud/4-near-mountain.png", depth: 0.42, phase: 4.2, y: -0.55 },
	{ url: "/images/backgroud/4-tree.png", depth: 0.62, phase: 0.6, y: 0.05 },
];

// --- Lobby panorama (menu backdrop) ---
// The lobby reuses the game's stage art but re-stages it: the maple tree is anchored to the LEFT
// edge, bigger and nearer, because its canopy is the SOURCE of the falling leaves (they detach
// from it and drift right across the scene — never spawn mid-air). Single source for the "Lobby"
// Leva folder.
export const LOBBY = {
	// Tree re-staging. The tree is anchored to TWO view edges so the composition holds at any
	// aspect: `treeEdge` = inset of its centre of mass from the visible LEFT edge (negative =
	// bleeds off), `treeBottom` = inset of its painted BASE from the visible BOTTOM edge (0 =
	// touching, negative = bleeds below — grounds it firmly). The art is a full-frame panel with
	// the tree far bottom-left INSIDE the frame, so LobbyScene back-computes the panel centre
	// from `treeAnchor`.
	treeEdge: 0.6,
	treeBottom: -0.1,
	treeScale: 2.4, // sized so that, base at the bottom edge, the canopy still reaches the top
	// The lobby pushes its horizon DOWN vs the duel's HORIZON_FRACTION (0.4): more painting, less
	// bare paper below. The tree also draws ABOVE the floor here (true foreground), so its base
	// stands on the ground instead of dissolving into the horizon wash.
	horizonFraction: 0.5,
	// Tree footprint inside 4-tree.png, as fractions of the frame (alpha > 160 — the soft ground
	// wash below that threshold is ignored): x/y = alpha-weighted centre of mass, bottom = lowest
	// painted row. Remeasure if the art is regenerated: scripts note in CLAUDE.md.
	treeAnchor: { x: 0.17, y: 0.79, bottom: 0.995 },
	// Canopy centre relative to the tree's mass centre (world x) — the leaf emitter follows the
	// tree through this offset, so moving/reanchoring the tree never orphans the leaves.
	treeCanopyOffsetX: -0.2,
	// Leaf particle field. Every leaf is born inside the canopy-aligned emitter box and dies
	// below the visible bottom, then re-enters from the canopy (deterministic per-index cycle).
	leaves: {
		count: 44,
		reducedCount: 4, // prefers-reduced-motion / low-end fallback
		emitterX: -2.6, // canopy centre (world) — LobbyScene OVERRIDES this to follow the tree; this default serves the pure-math tests
		emitterY: 1.3,
		emitterWidth: 2.2,
		emitterHeight: 0.9,
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
		birthStagger: 6, // seconds over which the field populates after release — leaves detach one by one
		growSeconds: 0.9, // per-leaf scale-in at each (re)birth, so a detach never pops
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
// All timings in seconds. Single source for the entry/exit/flight choreography (compile-time; no Leva folder).
export const INTRO = {
	// Entry: stage layers paint far → near, then sun/tree/mist/leaves, then the DOM menu.
	layerStagger: 0.28,
	layerFade: 0.9, // per-layer fade/rise duration
	leavesDelay: 1.8, // leaves become visible (storyboard beat 3)
	menuDelay: 2.5, // first DOM element (the logo) starts painting
	menuStagger: 0.35, // per-menu-item stagger after menuDelay
	total: 4.5, // full entry choreography (3D paint-on + DOM menu) — the natural finish beat
	// Exit veil: brush strokes cover one after another, then "dry" out in order.
	veilCover: 0.55, // one stroke's sweep duration
	veilStrokeStagger: 0.14,
	veilDry: 0.7, // one stroke's dry/fade-out duration
	// Ink paint-on (continuous wipe masks from scripts/ink_masks.py; see src/common/inkWipe.ts).
	strokePaint: 0.55, // one button stroke's draw duration
	veilDrag: 10, // vw of residual wrist-drag while a veil stroke is being drawn
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

// --- Card geometry (world units, at group scale 1) ---
// The GLB card body renders ~5:7 (see cardAlpha.ts). These are the on-screen
// footprint of a single card and are used both to frame the scene and to anchor
// the side drop zones to the viewport edges.
export const CARD_WIDTH = 0.7;
export const CARD_HEIGHT = CARD_WIDTH * (716 / 512); // ≈ 0.98

// The ACTUAL visible card silhouette at group scale 1: the card.glb body bounds (0.059 × 0.086)
// times the model's built-in ×7 scale (see CardModel). CARD_WIDTH/CARD_HEIGHT above are a LARGER
// framing footprint (scene fit + drop-zone margins), so overlays that must register exactly to the
// rendered card (e.g. the landing-zone placeholders) size themselves from these instead.
export const CARD_FACE_WIDTH = 0.059 * 7; // ≈ 0.413
export const CARD_FACE_HEIGHT = 0.086 * 7; // ≈ 0.602

// --- Card name label (the move name floating above a revealed card) ---
// Shown by CardNameReveal: `漢字 - romaji` floats just above the card as it rises for its action. The
// font auto-sizes to the card's on-screen width (so the line always fits inside it), then is scaled by
// `fontScale` and clamped to [minFontPx, maxFontPx]; `gap` is how far (world units) above the card's
// top edge it sits. Single source for the "Card Name" Leva folder.
export const CARD_NAME = {
	fontScale: 0.92, // fraction of the card's on-screen width the label line aims to fill
	maxFontPx: 24, // hard cap, so it never gets huge on wide screens
	minFontPx: 8, // floor, so it stays legible on tiny screens
	gap: 0.05, // world-units gap between the card's top edge and the label
} as const;

/** Structural shape shared by CARD_NAME and its live-tunable Leva controls. */
export interface CardNameConfig {
	fontScale: number;
	maxFontPx: number;
	minFontPx: number;
	gap: number;
}

// --- Played cards (committed pair + set-aside) ---
// A team's two committed cards rest landscape near the BOTTOM EDGE of the viewport, on that team's
// side (red left, blue right), STACKED one behind the other — the first card nearest the edge, the
// second just behind it. They stay there, face-down, until revealed:
//   • when a card is revealed it RISES into its team's lower corner and stands upright to be read,
//     held for the duration of its action;
//   • the first card then leaves toward the hand; the second instead lays flat near the battleline
//     on its team's side (the set-aside spot) for one round.
// The resting pair hugs the live viewport bottom corner; the set-aside card is anchored to the
// battleline origin (world coords). Single source for the "Played Cards" Leva folder.
export const PLAYED_CARDS = {
	// Resting committed pair: always landscape, faced square to the viewport (no tilt), on the team's
	// side, stacked top → bottom in reveal order (first on top, second below).
	restScale: 1.1,
	restEdgeMargin: 0.6, // x gap from the team's lateral viewport edge
	restY: 0.66, // Y of the lower (second) card above the viewport bottom
	restGap: 0.5, // vertical gap up to the upper (first) card
	restZ: 0.27, // forward of the line so the cards sit above the floor plane
	// The resting pair hugs the team's lateral edge; on a narrow landscape window that edge marches
	// inward over the battleline + set-aside card. Below this viewport WIDTH the pair lifts to the TOP
	// corner instead (only empty scenery up there, so it clears at any width).
	restTopWidth: 4.8, // viewport width under which the resting pair moves from the bottom to the top corner
	restTopMargin: 0.7, // gap from the top viewport edge down to the upper (first) resting card when lifted
	// Action: the revealed card rises landscape (horizontal) up to mid-page on its team's side, read
	// during its action.
	actionScale: 1.0,
	actionTilt: 0.0, // 0 = flat, facing the camera
	actionEdgeMargin: 0.7, // x gap from the viewport edge to the card centre
	actionY: 0, // Y offset from the page centre (mid-page)
	actionZ: 0.5,
	// First card leaving toward the hand once its action is resolved (slides down off the bottom).
	toHandX: 0.4, // x distance from centre (signed by team) on the way down
	toHandY: -0.7, // Y relative to the viewport bottom (negative = below, toward the hand)
	toHandScale: 0.55,
	// Set-aside: the second card laid flat near the battleline on its team's side for one round.
	setAsideScale: 0.8,
	setAsideRotZ: -Math.PI / 2, // landscape (laid flat near the line)
	setAsideTilt: 1.3, // rotationX magnitude — lays it flat onto the floor
	setAsideInset: -0.2, // x offset outward past the team's line end (red left, blue right)
	setAsideY: -1.1, // world Y, just in front of / below the battleline on the floor
	setAsideZ: 0.7,
	// Hover emphasis on a FACE-UP played card (face-down ones don't react):
	//  • a resting committed card scales up a touch and shifts toward the page centre (no lift);
	//  • the set-aside card instead lifts up, flattens (no tilt) and scales up a touch.
	raiseScale: 1.08, // scale multiplier when hovered (both)
	raiseShift: 0.25, // committed: world-X shift toward the page centre
	raiseLift: 0.18, // set-aside: world-Y lift when hovered
	// Portrait: a vertical COLUMN of upright cards at each team's side (turn player left, opponent right).
	playedScale: 0.24, // played-card height as a fraction of the viewport HEIGHT
	playedGap: -0.4, // world-Y gap between stacked cards in the column (negative = overlap)
	playedEdge: 0.1, // gap from the lateral viewport edge to the card's OUTER edge (keeps it inside)
	playedSetAside: 0.8, // relative scale of the set-aside card (below the committed pair)
	playedSetAsideOffset: -0.2, // extra world-Y nudge of the set-aside card only
	playedCenter: 0, // world-Y offset of the column centre from the viewport centre
} as const;

// --- Landing zones (portrait placeholders for where played cards land) ---
// In portrait, the committed pair (first / second) and the set-aside card each have a fixed spot in
// the team's side column. While a spot is EMPTY we show a placeholder there: a dashed outline the
// exact size + (rounded) shape of a card in a semi-transparent colour — the committed spots in one
// colour, carrying the Japanese numerals 一 / 二, and the set-aside spot in a different colour (no
// numeral). Once a card lands it covers the zone. Portrait only. Single source for the "Landing
// Zones" Leva folder.
// Per team: the committed (used-card) spots take the team's own colour (matching the pawns / board
// markers); the set-aside spot uses a softer, desaturated tone of the SAME team so it still reads as
// that side's reserve yet stays distinct from the bright committed pair.
export const LANDING_ZONES = {
	usedRed: "#cf463f", // red team's committed (used-card) spots — dash outline + numeral colour
	usedBlue: "#4a8aa0", // blue team's committed spots
	setAsideRed: "#d98b73", // red team's set-aside spot — softer tone of the same colour
	setAsideBlue: "#8fb7c2", // blue team's set-aside spot
	lineWidth: 2, // dash thickness (screen px)
	dash: 0.05, // dash length (world units along the outline)
	gap: 0.02, // gap between dashes (world units)
	cornerRadius: 0.08, // rounded-corner radius (world units) — matches the card silhouette
	inset: 0.03, // shrink the outline inside the card footprint, so it never pokes out past a card
	outlineOpacity: 0.35, // dash opacity
	fillOpacity: 0.08, // faint tint filling the zone
	numberScale: 0.24, // numeral height as a fraction of the zone (card) height — small, centred
	numberOpacity: 0.85,
} as const;

/** The Japanese numeral painted on each committed (used-card) landing zone. */
export const SLOT_KANJI: Record<Slot, string> = { first: "一", second: "二" };

/** Structural shape shared by LANDING_ZONES and its live-tunable Leva controls. */
export interface LandingZoneConfig {
	usedRed: string;
	usedBlue: string;
	setAsideRed: string;
	setAsideBlue: string;
	lineWidth: number;
	dash: number;
	gap: number;
	cornerRadius: number;
	inset: number;
	outlineOpacity: number;
	fillOpacity: number;
	numberScale: number;
	numberOpacity: number;
}

/** Half-width of the battlefield line (outermost board spaces). */
export const BATTLEFIELD_HALF_WIDTH = spaceToX(BOARD_SPACES - 1); // 1.5

/** Which lateral edge a team's corner/cards hug: red = left (−x), blue = right (+x). */
const teamEdgeSign = (team: Team): number => (team === "red" ? -1 : 1);

/** X of a team's battleline origin — the end of the line where its pawn starts. */
const teamOriginX = (team: Team): number => spaceToX(team === "red" ? RED_START : BLUE_START);

/** The role a played card plays in the current round, which drives where it sits. */
export type PlayedMode = "rest" | "action" | "toHand" | "setAside";

/** Live viewport span the cards anchor to (visible width/height, world-Y of the bottom edge + centre). */
export interface PlayedViewport {
	width: number;
	height: number;
	bottom: number;
	centerY: number;
}

/** Portrait played-card layout knobs (the column of committed + set-aside cards at the team's side). */
export interface PlayedPortrait {
	/** Which team sits at the bottom — the turn player; its cards go on the LEFT, the opponent's RIGHT. */
	bottomTeam: Team;
	/** Card height as a fraction of the viewport HEIGHT (proportional sizing). */
	scaleFrac: number;
	/** Vertical world gap between stacked cards in the column. */
	gap: number;
	/** X distance from the lateral viewport edge to the card centre. */
	edge: number;
	/** Relative scale of the set-aside card (below the committed pair). */
	setAsideScale: number;
	/** Extra world-Y nudge of the set-aside card only. */
	setAsideOffset: number;
	/** World-Y centre the column is anchored around. */
	centerY: number;
}

/** Structural shape shared by PLAYED_CARDS and its live-tunable Leva controls. */
export interface PlayedCardConfig {
	restScale: number;
	restEdgeMargin: number;
	restY: number;
	restGap: number;
	restZ: number;
	restTopWidth: number;
	restTopMargin: number;
	actionScale: number;
	actionTilt: number;
	actionEdgeMargin: number;
	actionY: number;
	actionZ: number;
	toHandX: number;
	toHandY: number;
	toHandScale: number;
	setAsideScale: number;
	setAsideRotZ: number;
	setAsideTilt: number;
	setAsideInset: number;
	setAsideY: number;
	setAsideZ: number;
	raiseScale: number;
	raiseShift: number;
	raiseLift: number;
	// Portrait column.
	playedScale: number;
	playedGap: number;
	playedEdge: number;
	playedSetAside: number;
	playedSetAsideOffset: number;
	playedCenter: number;
}

/**
 * Transform of a played card for its current role. Resting cards lie landscape at the team's edge
 * (first nearest the bottom); the revealed card rises upright into the team's lower corner; the
 * first card then drops toward the hand, the second lays flat to the side. All anchored to the
 * viewport so the cluster stays in the corners on any aspect.
 */
export const playedCardTransform = (
	team: Team,
	slot: Slot,
	mode: PlayedMode,
	viewport: PlayedViewport,
	cfg: PlayedCardConfig = PLAYED_CARDS,
	orientation: Orientation = "landscape",
	pp?: PlayedPortrait,
): CardTransform => {
	const sign = teamEdgeSign(team);
	const edgeX = (margin: number) => sign * (viewport.width / 2 - margin);
	// Portrait: the cards stand UPRIGHT (portrait) in a vertical COLUMN at the team's lateral edge —
	// the turn player (bottom team) on the LEFT, the opponent on the RIGHT. The committed pair stacks
	// first-on-top → second, with the set-aside card below them, slightly scaled. Sizes are a fraction
	// of the viewport height (proportional). Tunable in the "Portrait" folder.
	if (orientation === "portrait" && pp) {
		const side = team === pp.bottomTeam ? -1 : 1; // turn player left (−x), opponent right (+x)
		const scale = (pp.scaleFrac * viewport.height) / CARD_HEIGHT;
		const cardH = CARD_HEIGHT * scale;
		// `edge` is the gap from the viewport edge to the card's OUTER edge, so the card always stays
		// inside (account for its half-width). Negative `edge` lets it bleed off the edge on purpose.
		const x = side * (viewport.width / 2 - pp.edge - (CARD_WIDTH * scale) / 2);
		const step = cardH + pp.gap; // centre-to-centre of two full cards touching with `gap`
		switch (mode) {
			case "toHand":
				// First card leaving toward the hand (slides down off the bottom on its side).
				return {
					position: [side * cfg.toHandX, viewport.bottom + cfg.toHandY, cfg.actionZ],
					rotationZ: 0,
					rotationX: 0,
					scale: cfg.toHandScale,
				};
			case "setAside": {
				// Below the committed pair, in the same column, slightly scaled down (+ its own Y nudge).
				const saH = cardH * pp.setAsideScale;
				return {
					position: [x, pp.centerY - (cardH / 2 + pp.gap + saH / 2) + pp.setAsideOffset, cfg.restZ],
					rotationZ: 0,
					rotationX: 0,
					scale: scale * pp.setAsideScale,
				};
			}
			case "action":
			case "rest":
			default: {
				// First on top, second at the column centre. A revealed card (action) stays exactly on its
				// resting spot — it just flips face-up in place, it does NOT move.
				const y = slot === "first" ? pp.centerY + step : pp.centerY;
				return { position: [x, y, cfg.restZ], rotationZ: 0, rotationX: 0, scale };
			}
		}
	}
	switch (mode) {
		case "action":
			// Revealed: rises landscape (horizontal) up to mid-page on its team's side, held for the action.
			return {
				position: [edgeX(cfg.actionEdgeMargin), viewport.centerY + cfg.actionY, cfg.actionZ],
				rotationZ: -Math.PI / 2,
				rotationX: -cfg.actionTilt,
				scale: cfg.actionScale,
			};
		case "toHand":
			return {
				position: [sign * cfg.toHandX, viewport.bottom + cfg.toHandY, cfg.actionZ],
				rotationZ: 0,
				rotationX: 0,
				scale: cfg.toHandScale,
			};
		case "setAside":
			// Laid flat near the battleline on the team's side (just outside its end of the line).
			return {
				position: [teamOriginX(team) + sign * cfg.setAsideInset, cfg.setAsideY, cfg.setAsideZ],
				rotationZ: cfg.setAsideRotZ,
				rotationX: -cfg.setAsideTilt,
				scale: cfg.setAsideScale,
			};
		case "rest":
		default: {
			// Always landscape and faced square to the viewport (no tilt), on the team's side, with the
			// first card outermost (above the second). On a WIDE viewport the lateral edge sits clear of the
			// central battleline/set-aside, so the pair rests in the bottom corner; as the viewport NARROWS
			// the edge marches inward over them, so once the width drops below `restTopWidth` the pair lifts
			// to the TOP corner instead (empty scenery up there → it clears at any width).
			const isFirst = slot === "first";
			const crowded = viewport.width < cfg.restTopWidth;
			const y = crowded
				? viewport.centerY + viewport.height / 2 - cfg.restTopMargin - (isFirst ? 0 : cfg.restGap)
				: viewport.bottom + cfg.restY + (isFirst ? cfg.restGap : 0);
			return {
				// Same z for both cards: a z difference would parallax-shift their apparent x (they sit
				// near the frustum edge) and break the vertical alignment.
				position: [edgeX(cfg.restEdgeMargin), y, cfg.restZ],
				rotationZ: -Math.PI / 2, // landscape (fixed)
				rotationX: 0,
				scale: cfg.restScale,
			};
		}
	}
};

// --- Scene framing ---
// The locked camera keeps a fixed vertical band visible and centred on y = 0, so the
// battlefield stays in the middle and card sizes stay constant on wide windows. On
// narrower windows `halfWidth` dollies the camera back just enough to keep the whole
// battlefield + side-lane cluster framed, so the two systems stay fully visible and
// never overlap (the lanes clamp inward, the bottom-anchored hand repositions itself).
export interface SceneFrame {
	/** Min half-width to keep framed — the battlefield + clamped side lanes, plus a margin. */
	halfWidth: number;
	/** Top / bottom world-Y bounds of the always-visible band (kept symmetric → centred). */
	top: number;
	bottom: number;
}

export const DEFAULT_SCENE_FRAME: SceneFrame = {
	// Played cards now hug the live viewport edges, so they never constrain the framed width
	// inward: the minimum framed region is just the battlefield line plus a margin.
	halfWidth: BATTLEFIELD_HALF_WIDTH + 0.6,
	top: 1.6,
	bottom: -1.6,
};

// Reference visible height (the landscape frame's nominal height) that maps a marker to scale 1. The
// board markers/diamonds are sized as a fraction of the LIVE viewport height relative to this, so they
// read at a consistent on-screen size across orientations (and scale with the window) — landscape lands
// at ~1 (unchanged), portrait at the same on-screen size rather than a fixed, much larger world size.
export const MARKER_REF_HEIGHT = DEFAULT_SCENE_FRAME.top - DEFAULT_SCENE_FRAME.bottom; // 3.2

// Portrait: tall + narrow. Must fit the VERTICAL line (±BATTLEFIELD_HALF_WIDTH along Y) plus a
// pawn's height above the topmost space and a margin below for the hand. Symmetric so the line
// stays centred. `halfWidth` only needs to cover the lane offset + a pawn's half-width.
export const PORTRAIT_SCENE_FRAME: SceneFrame = {
	halfWidth: BATTLEGROUND.laneOffset + 0.6,
	top: BATTLEFIELD_HALF_WIDTH + 1.3,
	bottom: -(BATTLEFIELD_HALF_WIDTH + 1.3),
};

/** The visible world region for a given frame + viewport aspect. */
export interface FrameViewport {
	width: number;
	height: number;
	/** World Y of the visible bottom / vertical centre. */
	bottom: number;
	centerY: number;
}

/**
 * The world-space rectangle the locked camera actually shows, derived purely from the
 * frame and the viewport aspect — the same fit `FitCamera` applies, but computed without
 * touching the camera. Lets consumers (the hand, anchored to the bottom edge) position
 * themselves deterministically on the first render, instead of waiting for R3F to refresh
 * its cached viewport after the camera moves.
 */
export const frameViewport = (frame: SceneFrame, aspect: number): FrameViewport => {
	const halfHeight = (frame.top - frame.bottom) / 2;
	const centerY = (frame.top + frame.bottom) / 2;
	// Whichever axis forces the camera back also sets the visible half-height.
	const visibleHalfHeight = Math.max(halfHeight, frame.halfWidth / aspect);
	return {
		width: visibleHalfHeight * aspect * 2,
		height: visibleHalfHeight * 2,
		bottom: centerY - visibleHalfHeight,
		centerY,
	};
};

// --- Hand fan ---

/** Tunable fan geometry. `spread` and `fanHeight` are typically derived from the viewport. */
export interface FanConfig {
	cardStep: number;
	fanHeightOffset: number;
	spread: number;
	fanHeight: number;
	fanZ: number;
	curvature: number;
	hoverLift: number;
	hoverScale: number;
	baseScale: number;
	expansionStrength: number;
	entryStagger: number;
	/** Delay (ms) before a hovered card is actually released — debounces flicker at the edges. */
	hoverReleaseMs: number;
	/** Portrait only: card height as a fraction of the viewport HEIGHT (proportional sizing). */
	cardScale: number;
} /** Horizontal distance between adjacent card centres — smaller than a card → tight, overlapping fan. */

export const DEFAULT_FAN: FanConfig = {
	cardStep: 0.27,
	fanHeightOffset: 0.4, // small → the fan hugs the bottom edge, detached from the play area
	fanZ: 0.5,
	curvature: 0.12,
	baseScale: 1.05,
	hoverScale: 1.25,
	hoverLift: 0.5,
	expansionStrength: 0.3,
	spread: 1.3,
	fanHeight: -0.8,
	entryStagger: 0.1,
	hoverReleaseMs: 140,
	cardScale: 0.37, // portrait
};

// Invisible hover hit area for a hand card, anchored at the card's RESTING position (it does NOT
// lift with the card). This keeps the freed space *under* a lifted card hovered, while the extra
// `topExtend` covers the lift so following the card upward stays continuous. Sizes × CARD_* footprint.
// Hover hit zone = the card's exact footprint plus a downward extension only. The pointer hovers a
// card precisely over its borders (no side/top slop, so it never steals the neighbour); leaving any
// border drops the hover — EXCEPT below, where the zone extends so the freed space under a lifted
// card (and the column beneath it) keeps the card hovered. The zone tracks the card's resting,
// expanded x (see Hand), but never lifts. `widthScale` 1 = exactly the card width.
export const HAND_HOVER_HIT = {
	widthScale: 1.0, // × card width — 1 matches the visible card border exactly
	bottomExtend: 0.45, // how far below the card's bottom border the hover still holds
} as const;

// The hand fan is the always-on-top layer: this bias is added to every fan card's z-derived renderOrder so
// the whole hand sits well ABOVE the pawns (PAWN.renderOrder) and everything else, regardless of how `fanZ`
// is tuned. Committed / set-aside cards keep their own (lower) order, so pawns can still cover THOSE.
export const HAND_RENDER_BIAS = 100;

// Touch interaction affordance. With no hover, a tap LIFTS a card and a second tap CONFIRMS it — so a
// lifted (armed) card gently "breathes" to signal it's waiting for that confirming second tap. The pulse
// is a subtle scale yoyo layered on TOP of the card's own transform (a nested group in HandCard).
export const TOUCH_HINT = {
	pulseScale: 1.05, // peak scale of the breathing pulse (× the card's settled scale)
	pulseSeconds: 0.7, // one half-cycle (rise); the fall mirrors it via yoyo
	liftScale: 1.18, // touch only: extra blow-up of a lifted card vs the hover lift (fat fingers need it bigger)
	liftRaise: 2, // touch only: × the hover lift — a tapped card rises clear of the hand so both halves of a
	// split card are reachable above the fan
} as const;

// Portrait sits the fan low so the cards' bottom edges tuck slightly BELOW the viewport (they read as a
// hand held at the bottom of the screen). It's the fan-folder default for the Portrait sub-folder.
export const PORTRAIT_FAN_HEIGHT_OFFSET = 0.5;

// Touch drag-and-drop (portrait): slide a finger across the fan to browse-select, then lift a card off the
// hand — it's selected as soon as it clears the fan (no need to reach a landing zone; a zone only lets you
// drop straight into that slot). A committed card can be dragged back to the hand to unplace it.
export const TOUCH_DRAG = {
	bandMargin: 0.2, // world units above the fan's top edge that still count as "the hand" (browse zone);
	// lifting past it detaches/selects the card
	dropTolerance: 1.45, // enlarge each slot's hit rect by this factor so dropping is forgiving on a phone
	moveThreshold: 0.06, // world units the finger must travel before a press counts as a drag (vs a tap)
} as const;

export interface CardTransform {
	position: [number, number, number];
	rotationZ: number;
	/** Tilt about X — used to lay played cards back onto the floor (0 = facing the camera). */
	rotationX?: number;
	scale: number;
}

/** Per-card cascade entry timing (cards rise from below the viewport, one after another). */
export interface CardEntry {
	fromY: number;
	delay: number;
}

const parabola = (normalizedX: number, curvature: number) => {
	const y = -curvature * normalizedX * normalizedX;
	const rotation = Math.atan(-2 * curvature * normalizedX);
	return { y, rotation };
};

/** Transform for a card at `index` of `count` cards, given the hovered index. */
export const fanTransform = (index: number, count: number, hoveredIndex: number | null, cfg: FanConfig = DEFAULT_FAN): CardTransform => {
	const half = cfg.spread / 2;

	let x = count <= 1 ? 0 : ((index / (count - 1)) * 2 - 1) * half;

	// Neighbours slide away from the hovered card.
	if (hoveredIndex !== null && hoveredIndex !== index && count > 1) {
		const distance = Math.abs(index - hoveredIndex);
		const influence = Math.max(0, 1 - distance / 2);
		const direction = index < hoveredIndex ? -1 : 1;
		x += direction * cfg.expansionStrength * influence;
	}

	const normalizedX = count > 1 ? x / half : 0;
	const { y: parabolicY, rotation } = parabola(normalizedX, cfg.curvature);

	let finalX = x;
	let finalY = cfg.fanHeight + parabolicY;
	const isHovered = hoveredIndex === index;
	if (isHovered) {
		finalX += -Math.sin(rotation) * cfg.hoverLift;
		finalY += Math.cos(rotation) * cfg.hoverLift;
	}

	return {
		position: [finalX, finalY, cfg.fanZ + index * 0.02],
		rotationZ: rotation,
		scale: isHovered ? cfg.hoverScale : cfg.baseScale,
	};
};

export interface HandFanFit {
	/** End-to-end spread between the outermost card centres. */
	spread: number;
	/** Per-card base scale (shrunk together with the spread when space is tight). */
	scale: number;
}

/**
 * Size the fan so it never exceeds `available` world width: the cards keep their
 * natural step until the whole fan would overflow, then step *and* card size
 * shrink together (uniform scale-down) so every card stays inside the viewport.
 */
export const fitHandFan = (count: number, available: number, step: number, baseScale: number): HandFanFit => {
	const naturalSpread = step * Math.max(count - 1, 0);
	const footprint = naturalSpread + CARD_WIDTH * baseScale; // outer edge to outer edge
	const fit = footprint > available && footprint > 0 ? available / footprint : 1;
	return { spread: naturalSpread * fit, scale: baseScale * fit };
};
