import { useEffect, useRef, useState } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { HandCard } from "../../molecules";
import {
	fanTransform,
	fitHandFan,
	frameViewport,
	playedCardTransform,
	DEFAULT_FAN,
	DEFAULT_SCENE_FRAME,
	CARD_WIDTH,
	CARD_HEIGHT,
	CARD_FACE_WIDTH,
	CARD_FACE_HEIGHT,
	HAND_HOVER_HIT,
	HAND_RENDER_BIAS,
	TOUCH_HINT,
	TOUCH_DRAG,
	type SceneFrame,
	type CardTransform,
	type FanConfig,
	type CardEntry,
	type PlayedMode,
	type Orientation, playedViewport
} from "../../../layout";
import { useFanControls } from "../../../hooks/useFanControls";
import { useCoarsePointer } from "../../../hooks/useCoarsePointer";
import { usePlayedCardControls } from "../../../hooks/usePlayedCardControls";
import { useBottomTeam, CONFIRM_COVER_MS, CONFIRM_HAND_IN_MS } from "../../../hooks/useBottomTeam";
import { useHandoffPending } from "../../../hooks/useHandoffPending";
import { useDuelIntroReached } from "../../../state/duelIntro";
import { useLagged } from "../../../hooks/useLagged";
import { useGame, currentHandViews, placedViews, setAsideViews, type CardView } from "../../../state";
import { useSession } from "../../../net";
import type { Side, Slot } from "../../../game";

interface Renderable {
	view: CardView;
	target: CardTransform;
	entry?: CardEntry;
	exit?: { from: CardTransform };
	/** Resting (non-hovered) transform — anchors the stationary hover hit zone for fan cards. */
	hitAnchor?: CardTransform;
	/** Hover hit-zone geometry (local to hitAnchor): width, height, vertical centre. */
	hit?: { w: number; h: number; y: number };
	/** Draw-order offset on top of the z-derived order (e.g. push set-aside behind committed cards). */
	renderBias?: number;
}

/** A live touch drag (portrait): `place` drags a hand card to a landing zone, `revert` a committed card back. */
interface DragState {
	/** The selected card that follows the finger (can change while browsing the fan). */
	key: string;
	mode: "place" | "revert";
	/** True once the finger has left the hand band — the card detaches and follows the finger. */
	lifted: boolean;
	/** Current finger position, projected onto the card plane (world x/y). */
	pt: [number, number];
	/** The drop slot under the finger (place mode), or null. */
	slot: Slot | null;
	/** The finger is over the hand band (revert mode → will unplace on release). */
	overHand: boolean;
	/** Movement card: which half the press started on — the side a plain tap will play. */
	side: Side | null;
	/** Latched once the finger travels past the tap threshold — below it the press stays a TAP (which only
	 *  arms/lifts), so sub-threshold jitter never enters browse and silently confirms on release. */
	moved: boolean;
}

export interface HandProps {
	/** Scene framing — the hand derives its bottom anchor + width from it (and the aspect). */
	frame?: SceneFrame;
	/** Portrait repositions the committed / set-aside cards clear of the bottom pawn + hand. */
	orientation?: Orientation;
}

/** Renders the current team's fan plus every committed / set-aside card. */
export const Hand = ({ frame = DEFAULT_SCENE_FRAME, orientation = "landscape" }: HandProps) => {
	const { state, dispatch } = useGame();
	const { viewerTeam } = useSession();
	const [hoveredKey, setHoveredKey] = useState<string | null>(null);
	// Touch / no-hover devices use a two-tap model: the first tap LIFTS (arms) a card, the second
	// CONFIRMS it. Hover-driven lift is disabled there so a single tap can't lift-and-place at once.
	const coarse = useCoarsePointer();
	const size = useThree((s) => s.size);
	const portrait = orientation === "portrait";
	const ctrl = useFanControls(orientation);
	// Hovering lifts/grows a card, which can pull its hit area off the pointer near the edges. Debounce
	// the release so a quick out→in (or card→margin) flicker doesn't toggle the selection. A re-hover
	// cancels the pending release.
	const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const cancelRelease = () => {
		if (releaseTimer.current) {
			clearTimeout(releaseTimer.current);
			releaseTimer.current = null;
		}
	};
	const hover = (key: string) => {
		cancelRelease();
		setHoveredKey(key);
	};
	const endHover = (key: string) => {
		cancelRelease();
		releaseTimer.current = setTimeout(() => {
			releaseTimer.current = null;
			setHoveredKey((k) => (k === key ? null : k));
		}, ctrl.hoverReleaseMs);
	};
	useEffect(() => () => cancelRelease(), []);
	// Show the pointer cursor while a hand card is hovered (R3F doesn't set it for 3D meshes).
	useEffect(() => {
		document.body.style.cursor = hoveredKey ? "pointer" : "auto";
		return () => {
			document.body.style.cursor = "auto";
		};
	}, [hoveredKey]);
	const played = usePlayedCardControls(orientation);
	const [exiting, setExiting] = useState<Renderable[]>([]);
	const prevFan = useRef<Map<string, Renderable>>(new Map());
	// Touch drag-and-drop. The ref mirrors the state so the (re-created each render) move/up handlers always
	// read the live gesture; `startRef` holds the press origin to tell a tap from a drag.
	const [drag, setDrag] = useState<DragState | null>(null);
	const dragRef = useRef<DragState | null>(null);
	const setDragState = (d: DragState | null) => {
		dragRef.current = d;
		setDrag(d);
	};
	const startRef = useRef<[number, number] | null>(null);
	// The world region the locked camera shows, derived from the frame + aspect — correct
	// on the first render (no dependency on R3F's camera-lagged cached viewport).
	const viewport = frameViewport(frame, size.width / size.height);

	// Portrait CONFIRM choreography (no-op in landscape): on a placer change the hand drops first, then
	// the cards cover, then the view inverts, then the hand rises back. `coverSettled`/`fanShown` are
	// `false` only during the matching beats of that sequence (driven by the same target as bottomTeam).
	const bottomTarget = viewerTeam;
	const coverLag = useLagged(bottomTarget, CONFIRM_COVER_MS);
	const handLag = useLagged(bottomTarget, CONFIRM_HAND_IN_MS);
	// The viewer team just before a hand-over (lagged) — only THEIR cards are held face-up during the
	// cover beat, so the other team's already-covered cards stay covered.
	const heldPlacer = useLagged(viewerTeam, CONFIRM_COVER_MS);
	const coverSettled = !portrait || coverLag === bottomTarget;
	const fanShown = !portrait || handLag === bottomTarget;

	// Pass & play: on a hand-over the outgoing hand slides down, the HandoffVeil inks in, and the incoming
	// hand rises only once the veil is tapped away — never shown to the wrong player.
	const handoffPending = useHandoffPending();
	// Duel opening: no hand until the samurai have stood up and the HUD is in — then red's rises.
	const turnOpen = useDuelIntroReached("turn");

	// The fan only shows while the viewer is still placing (not yet confirmed) — and, in portrait, once
	// the turn-change choreography has brought it back up.
	const isPlacing = state.phase === "place" && !state.confirmed[viewerTeam];
	const handViews = isPlacing && fanShown && turnOpen && !handoffPending ? currentHandViews(state, viewerTeam) : [];
	const hoveredIndex = handViews.findIndex((v) => v.key === hoveredKey);

	// Tight, overlapping fan anchored to the bottom edge of the viewport. When it would
	// overflow the visible width, step *and* card size shrink together so every card
	// stays on-screen. (Plain computation — the React Compiler memoizes it.)
	// Portrait: size the cards to a fraction of the viewport HEIGHT (the step follows, keeping the
	// fan's proportions) so they scale with the window; fitHandFan still caps them to the width.
	const count = handViews.length;
	const targetScale = portrait ? (ctrl.cardScale * viewport.height) / CARD_HEIGHT : ctrl.baseScale;
	const targetStep = portrait && ctrl.baseScale > 0 ? targetScale * (ctrl.cardStep / ctrl.baseScale) : ctrl.cardStep;
	const { spread, scale } = fitHandFan(count, viewport.width * 0.92, targetStep, targetScale);
	// hoverScale is an ABSOLUTE scale; ctrl.hoverScale is calibrated against ctrl.baseScale, so apply it
	// as a RATIO to the actual fitted base — otherwise in portrait (where the base is the much larger
	// proportional scale) a hovered card would end up SMALLER than its resting size.
	// Touch: blow a lifted card up a bit more than the hover lift — it's the active target awaiting the
	// confirming tap, and fingers need the bigger hit area.
	const hoverMult = (ctrl.baseScale > 0 ? ctrl.hoverScale / ctrl.baseScale : 1.2) * (coarse ? TOUCH_HINT.liftScale : 1);
	const fan: FanConfig = {
		...DEFAULT_FAN,
		spread,
		fanHeight: viewport.bottom + ctrl.fanHeightOffset,
		fanZ: ctrl.fanZ,
		curvature: ctrl.curvature,
		baseScale: scale,
		hoverScale: scale * hoverMult,
		// Touch: lift a tapped card higher so it clears the hand — for split cards both halves end up above
		// the fan and are easy to tap.
		hoverLift: ctrl.hoverLift * (coarse ? TOUCH_HINT.liftRaise : 1),
		expansionStrength: ctrl.expansionStrength,
	};
	const entryFromY = viewport.bottom - 1.3; // start off-screen, below the bottom edge

	// Hover-zone anchor: same fan (so neighbours' expansion is tracked and the zone stays under each
	// card horizontally) but with NO lift/scale, so the zone sits at the resting height — the freed
	// space under a lifted card stays covered, and the zones never drift off their cards.
	const restFan: FanConfig = { ...fan, hoverLift: 0, hoverScale: fan.baseScale };
	const hovered = hoveredIndex >= 0 ? hoveredIndex : null;
	// Hover hit-zone (in the resting group's local space, where group scale = baseScale):
	//  • not hovered → the card's EXACT footprint, so engaging is precise and never steals a neighbour;
	//  • hovered → a larger KEEP zone covering the lifted + scaled card and the column below it, so the
	//    selection holds as the card grows/rises and while the pointer sits in the freed space beneath.
	const bs = fan.baseScale || 1;
	const liftLocal = fan.hoverLift / bs;
	const scaleRatio = fan.hoverScale / bs;
	// Width stays the card's own width in BOTH states (never wider than the card) so a hovered card's
	// zone can't reach sideways onto a neighbour. Only the height grows when hovered (up to the lifted,
	// scaled card; down the freed column). Continuous onPointerMove + stopPropagation then makes the
	// front-most card under the pointer the single hovered one.
	const hitZone = (isHovered: boolean) => {
		const w = CARD_WIDTH * HAND_HOVER_HIT.widthScale;
		if (!isHovered) return { w, h: CARD_HEIGHT, y: 0 };
		const top = liftLocal + (CARD_HEIGHT / 2) * scaleRatio + 0.12; // reach above the lifted, scaled card
		const bottom = -(CARD_HEIGHT / 2 + HAND_HOVER_HIT.bottomExtend); // and below the resting bottom edge
		return { w, h: top - bottom, y: (top + bottom) / 2 };
	};
	// Touch: a lifted card is blown up and (for the fan's edge cards) tilted, so near the screen edges it
	// would spill off the viewport — and a clipped movement card hides one of its two tappable halves.
	// Clamp the lifted card's centre so its whole rotated, scaled silhouette (incl. the pulse peak) stays
	// on-screen. Keeps its fan tilt; only nudges it inward as much as needed.
	const clampLifted = (t: CardTransform): CardTransform => {
		const s = t.scale * TOUCH_HINT.pulseScale; // the breathing pulse briefly enlarges it further
		const c = Math.abs(Math.cos(t.rotationZ));
		const sin = Math.abs(Math.sin(t.rotationZ));
		const halfW = ((c * CARD_FACE_WIDTH + sin * CARD_FACE_HEIGHT) * s) / 2; // rotated AABB half-extents
		const halfH = ((sin * CARD_FACE_WIDTH + c * CARD_FACE_HEIGHT) * s) / 2;
		const margin = 0.04;
		const minX = -viewport.width / 2 + halfW + margin;
		const maxX = viewport.width / 2 - halfW - margin;
		const top = viewport.centerY + viewport.height / 2 - halfH - margin;
		const bottom = viewport.centerY - viewport.height / 2 + halfH + margin;
		const [tx, ty, tz] = t.position;
		const x = minX <= maxX ? Math.min(Math.max(tx, minX), maxX) : 0;
		const y = bottom <= top ? Math.min(Math.max(ty, bottom), top) : viewport.centerY;
		return { ...t, position: [x, y, tz] };
	};
	// Played-card context — computed here (before the fan render) because the drop-zone geometry below
	// needs it. The turn player (bottom team) sits on the LEFT, opponent right; lagged so played cards
	// cover in place on CONFIRM before the column swaps sides with the view.
	const playedVp = playedViewport(viewport, size.height);
	const bottomTeam = useBottomTeam(viewerTeam);
	const playedPortrait = portrait
		? { bottomTeam, scaleFrac: played.playedScale, gap: played.playedGap, edge: played.playedEdge, setAsideScale: played.playedSetAside, setAsideOffset: played.playedSetAsideOffset, centerY: viewport.centerY + played.playedCenter }
		: undefined;

	// --- Touch drag-and-drop (portrait) ---
	// The world-Y up to which the finger still counts as "in the hand" (browse the fan). It sits just above
	// the resting fan's top edge, so lifting a card even a little off the hand detaches/selects it — no need
	// to drag all the way to a landing zone.
	const fanBandTop = fan.fanHeight + (CARD_FACE_HEIGHT * fan.baseScale) / 2 + TOUCH_DRAG.bandMargin;
	// The current team's still-empty committed slots as world-space drop rectangles. Portrait only — the
	// dashed landing zones (and thus a legible drop target) exist only there.
	const dropSlots =
		coarse && portrait && isPlacing
			? (["first", "second"] as Slot[])
					.filter((slot) => !state[viewerTeam].placed[slot])
					.map((slot) => {
						const t = playedCardTransform(viewerTeam, slot, "rest", playedVp, played, orientation, playedPortrait);
						const sc = t.scale;
						return { slot, x: t.position[0], y: t.position[1], halfW: ((CARD_FACE_WIDTH * sc) / 2) * TOUCH_DRAG.dropTolerance, halfH: ((CARD_FACE_HEIGHT * sc) / 2) * TOUCH_DRAG.dropTolerance };
					})
			: [];
	const dropSlotAt = (x: number, y: number): Slot | null => dropSlots.find((z) => Math.abs(x - z.x) < z.halfW && Math.abs(y - z.y) < z.halfH)?.slot ?? null;
	// Project a pointer onto the card plane (z = fanZ) for its world x/y — robust even when the finger has
	// left every mesh (pointer capture keeps the events flowing; the ray is always current).
	const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -fan.fanZ);
	const project = (e: ThreeEvent<PointerEvent>): [number, number] | null => {
		const v = new THREE.Vector3();
		return e.ray.intersectPlane(dragPlane, v) ? [v.x, v.y] : null;
	};
	// Which fan card sits under a world-x — for browse-select while sliding along the hand.
	const nearestFanKey = (x: number): string | null => {
		if (!handViews.length) return null;
		let best = 0;
		let bd = Infinity;
		for (let i = 0; i < handViews.length; i++) {
			const d = Math.abs(fanTransform(i, handViews.length, null, fan).position[0] - x);
			if (d < bd) {
				bd = d;
				best = i;
			}
		}
		return handViews[best].key;
	};
	// While a card is dragged out (or a committed card reverted), it follows the finger — snapping to a drop
	// slot's centre when over one. Otherwise the caller's resting/lifted transform is kept.
	const dragTargetFor = (view: CardView, fallback: CardTransform): CardTransform => {
		if (!drag || !drag.lifted || drag.key !== view.key) return fallback;
		const over = drag.mode === "place" && drag.slot ? dropSlots.find((s) => s.slot === drag.slot) : undefined;
		const pos: [number, number, number] = over ? [over.x, over.y, fallback.position[2]] : [drag.pt[0], drag.pt[1], fallback.position[2]];
		return clampLifted({ position: pos, rotationZ: 0, scale: fan.hoverScale });
	};
	const fanItems: Renderable[] = handViews.map((view, i) => {
		const raw = fanTransform(i, handViews.length, hovered, fan);
		const base = coarse && i === hoveredIndex ? clampLifted(raw) : raw;
		return {
			view,
			target: dragTargetFor(view, base),
			hitAnchor: fanTransform(i, handViews.length, hovered, restFan),
			hit: hitZone(i === hoveredIndex),
			entry: { fromY: entryFromY, delay: i * ctrl.entryStagger },
			// The hand is the top layer: bias it clear of the pawns (and everything) regardless of fan z.
			renderBias: HAND_RENDER_BIAS,
		};
	});

	const otherItems: Renderable[] = [];
	// Played cards live in the lateral corners: each team's two committed cards rest landscape at that
	// team's edge (first nearest the bottom, second above). On reveal a card rises upright into the
	// team's lower corner for its action; the first then leaves toward the hand and the second lays
	// flat to the side. The mode (which playedCardTransform turns into a transform) is phase-driven —
	// HandCard just tweens to whatever target it gets, so the role changes animate themselves.
	const slotMode = (slot: Slot): PlayedMode => {
		switch (state.phase) {
			case "reveal-first":
				return slot === "first" ? "action" : "rest";
			case "reveal-second":
				return slot === "first" ? "toHand" : "action";
			case "game-over":
				// Victory: every played card returns toward its owner's hand, clearing the table.
				return "toHand";
			default:
				return "rest";
		}
	};
	// Hover emphasis on a face-up played card. A committed (rest) card scales up a touch and shifts
	// toward the page centre (no lift). The set-aside card instead lifts up, flattens (no tilt) and
	// scales up a touch. The hover zone is a flat, screen-facing rectangle anchored at the resting
	// position. The two stacked committed cards are big and close, so their footprints would overlap
	// and fight over the hover; instead each committed zone is TILED — clamped on the side facing its
	// neighbour to half the gap, so they meet exactly at the midline and never share a band.
	const isLandscape = (rotZ: number) => Math.abs(Math.abs(rotZ) - Math.PI / 2) < 0.5;
	const playedHitZone = (raised: boolean, base: CardTransform, mode: PlayedMode, slot: Slot | undefined) => {
		const land = isLandscape(base.rotationZ);
		const tilt = Math.abs(base.rotationX ?? 0);
		const scale = base.scale || 1;
		const footW = land ? CARD_HEIGHT : CARD_WIDTH;
		const vert = land ? CARD_WIDTH : CARD_HEIGHT; // upright (un-foreshortened) vertical extent
		const footH = vert * Math.cos(tilt);
		if (mode === "setAside") {
			if (!raised) return { w: footW, h: footH, y: 0 };
			// Grows upward to follow the lifted, flattened card (zone is in the card-scaled group).
			const liftLocal = played.raiseLift / scale;
			const top = liftLocal + (vert / 2) * played.raiseScale + 0.1;
			const bottom = -footH / 2 - 0.1;
			return { w: footW * played.raiseScale, h: top - bottom, y: (top + bottom) / 2 };
		}
		// Portrait: the committed pair sits in a vertical COLUMN spaced by `step` (not the tightly
		// overlapping landscape pair), so each card uses its FULL footprint — no neighbour tiling — and
		// the whole card is hoverable (so the raise actually triggers).
		if (!land) {
			if (!raised) return { w: footW, h: footH, y: 0 };
			return { w: footW * played.raiseScale + 2 * (played.raiseShift / scale), h: footH * played.raiseScale, y: 0 };
		}
		// Committed pair (landscape): keep the outer side full, clamp the side facing the neighbour to half the gap.
		const outerHalf = footH / 2;
		const innerHalf = Math.min(outerHalf, played.restGap / (2 * scale));
		const neighbourBelow = slot === "first"; // the first card is on top (second sits below it)
		const halfUp = neighbourBelow ? outerHalf : innerHalf;
		const halfDown = neighbourBelow ? innerHalf : outerHalf;
		const w = footW * (raised ? played.raiseScale : 1) + (raised ? 2 * (played.raiseShift / scale) : 0);
		return { w, h: halfUp + halfDown, y: (halfUp - halfDown) / 2 };
	};
	// Played cards never overlap now (rest stacked, action / toHand / setAside all distinct), so they
	// keep their own z — no per-card bias, which would parallax-shift their apparent x.
	const pushPlayed = (view: CardView, base: CardTransform, mode: PlayedMode) => {
		const canRaise = view.faceUp && (mode === "rest" || mode === "setAside");
		const raised = canRaise && view.key === hoveredKey;
		const isSetAside = mode === "setAside";
		const [bx, by, bz] = base.position;
		// Always nudge a raised card toward the central line (x = 0), from whichever side it sits on. Keying
		// off the card's actual x (not its team) stays correct in portrait, where the turn player — and so
		// each team's side — swaps with the inverted view.
		const towardCenter = bx <= 0 ? 1 : -1;
		let target: CardTransform = { ...base, position: [bx, by, bz] };
		if (raised) {
			target = isSetAside
				? { ...base, position: [bx, by + played.raiseLift, bz], rotationX: 0, scale: base.scale * played.raiseScale }
				: { ...base, position: [bx + towardCenter * played.raiseShift, by, bz], scale: base.scale * played.raiseScale };
		}
		const item: Renderable = { view, target: dragTargetFor(view, target) };
		// The set-aside card always draws behind the committed cards when they overlap, regardless of
		// its (larger) z — its z positions it near the battleline but shouldn't win the draw order.
		if (isSetAside) item.renderBias = -100;
		if (canRaise) {
			// Stationary flat hover zone at the resting position (a little forward so it's pickable).
			item.hitAnchor = { position: [bx, by, bz + 0.12], rotationZ: 0, scale: base.scale };
			item.hit = playedHitZone(raised, base, mode, view.slot);
		}
		otherItems.push(item);
	};
	const isGameOver = state.phase === "game-over";
	placedViews(state, viewerTeam).forEach((rawView) => {
		const slot = rawView.slot as Slot;
		const mode = slotMode(slot);
		// CONFIRM choreography: keep the just-placed committed cards (the leaving placer's) face-up until
		// the cover beat, so the hand drops first and only then do they flip face-down (in place). The
		// other team's cards are already covered and must stay covered.
		const view = !coverSettled && mode === "rest" && rawView.team === heldPlacer ? { ...rawView, faceUp: true } : rawView;
		const base = playedCardTransform(view.team, slot, mode, playedVp, played, orientation, playedPortrait);
		// On the victory return-to-hand, fan the two cards apart a touch so they don't overlap as one.
		const target = isGameOver
			? { ...base, position: [base.position[0] + (slot === "first" ? 0.18 : -0.18), base.position[1], base.position[2]] as [number, number, number] }
			: base;
		pushPlayed(view, target, mode);
	});
	// Set-aside cards also return to hand on victory; otherwise they stay laid flat by the line.
	setAsideViews(state, viewerTeam).forEach((view) => {
		const mode: PlayedMode = isGameOver ? "toHand" : "setAside";
		pushPlayed(view, playedCardTransform(view.team, "second", mode, playedVp, played, orientation, playedPortrait), mode);
	});

	// Exit animation: cards that just left the fan without moving to a slot stay mounted briefly
	// as "ghosts" that slide down off-screen, then get dropped (timer-based, like CombatToast).
	const present = new Set([...fanItems, ...otherItems].map((it) => it.view.key));
	const fanSig = fanItems.map((it) => it.view.key).join(",");
	const dropY = viewport.bottom - 0.8;
	useEffect(() => {
		const leaving: Renderable[] = [];
		prevFan.current.forEach((it, key) => {
			if (present.has(key)) return;
			const from = it.target;
			leaving.push({
				view: { ...it.view, interactive: false },
				target: { position: [from.position[0], dropY, from.position[2]], rotationZ: from.rotationZ, scale: from.scale * 0.85 },
				exit: { from },
			});
		});
		prevFan.current = new Map(fanItems.map((it) => [it.view.key, it]));
		if (leaving.length === 0) return;
		const keys = new Set(leaving.map((l) => l.view.key));
		const add = setTimeout(() => setExiting((g) => [...g.filter((e) => !keys.has(e.view.key)), ...leaving]), 0);
		const drop = setTimeout(() => setExiting((g) => g.filter((e) => !keys.has(e.view.key))), 600);
		return () => {
			clearTimeout(add);
			clearTimeout(drop);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fanSig]);

	const ghosts = exiting.filter((e) => !present.has(e.view.key));
	const items: Renderable[] = [...otherItems, ...fanItems, ...ghosts];

	// Placing/unplacing a card moves it out from under a stationary pointer; R3F won't fire pointerout
	// without movement, so the card would stay stuck in its hovered (scaled/shifted) state. Clear the
	// hover explicitly on the click so the card settles into / out of its slot cleanly.
	// Two-tap gate: on touch, a tap on a card that isn't already lifted just arms it (first tap = lift);
	// only a tap on the already-armed card runs the action (second tap = confirm). On hover devices the
	// card is already lifted by the pointer, so the very first click confirms (unchanged behaviour).
	const needsArming = (view: CardView) => coarse && hoveredKey !== view.key;
	const place = (view: CardView, side: Side | null) => {
		if (needsArming(view)) {
			hover(view.key);
			return;
		}
		const slot: Slot = state[viewerTeam].placed.first ? "second" : "first";
		dispatch({ type: "PLACE_CARD", slot, cardId: view.cardId, side });
		cancelRelease();
		setHoveredKey(null);
	};
	const unplace = (view: CardView) => {
		if (!view.slot) return;
		if (needsArming(view)) {
			hover(view.key);
			return;
		}
		dispatch({ type: "UNPLACE_CARD", slot: view.slot });
		cancelRelease();
		setHoveredKey(null);
	};

	// --- Touch drag-and-drop gesture (pointer-capture based; single cards only — movement cards keep tap) ---
	// Resolve a dragged card's key back to its live view (hand or committed) for the place/unplace dispatch.
	const viewByKey = new Map<string, CardView>([...handViews, ...placedViews(state, viewerTeam)].map((v) => [v.key, v]));
	const setCapture = (e: ThreeEvent<PointerEvent>, on: boolean) => {
		const t = e.target as unknown as { setPointerCapture?: (id: number) => void; releasePointerCapture?: (id: number) => void };
		if (on) t.setPointerCapture?.(e.pointerId);
		else t.releasePointerCapture?.(e.pointerId);
	};
	// `side` is the pressed half for movement cards (a plain tap plays it); null for regular cards.
	const startDrag = (view: CardView, side: Side | null) => (e: ThreeEvent<PointerEvent>) => {
		if (!coarse) return;
		e.stopPropagation();
		setCapture(e, true);
		const p = project(e) ?? [0, 0];
		startRef.current = p;
		const mode: DragState["mode"] = view.location === "slot" ? "revert" : "place";
		// Revert lifts immediately (the committed card follows from the first move); place stays in the fan
		// until the finger leaves the band, so a pure tap still falls through to the two-tap arm/confirm.
		setDragState({ key: view.key, mode, lifted: mode === "revert", pt: p, slot: null, overHand: false, side, moved: false });
		if (mode === "revert") setHoveredKey(view.key);
	};
	const onCardMove = (e: ThreeEvent<PointerEvent>) => {
		const d = dragRef.current;
		if (!d || !coarse) return;
		e.stopPropagation();
		const p = project(e);
		if (!p) return;
		const [x, y] = p;
		// A place gesture only becomes a DRAG once the finger travels past the tap threshold; until then it's
		// still a tap and must NOT browse/arm (or the release would confirm it — a one-tap place). Once past,
		// latch `moved` so a small back-swing doesn't drop it back to tap. Revert starts lifted, so it drags at once.
		const far = !!startRef.current && Math.hypot(x - startRef.current[0], y - startRef.current[1]) > TOUCH_DRAG.moveThreshold;
		if (d.mode === "place" && !d.moved && !far) return;
		const moved = d.moved || far;
		if (d.mode === "place") {
			if (!d.lifted && y <= fanBandTop) {
				// browse the fan: select the card under the finger
				const k = nearestFanKey(x);
				if (k && k !== hoveredKey) setHoveredKey(k);
				setDragState({ ...d, key: k ?? d.key, pt: [x, y], moved });
			} else {
				// dragged out of the band: the selected card now follows the finger toward a drop slot
				if (d.key !== hoveredKey) setHoveredKey(d.key);
				setDragState({ ...d, lifted: true, pt: [x, y], slot: dropSlotAt(x, y), moved });
			}
		} else {
			setDragState({ ...d, lifted: true, pt: [x, y], overHand: y <= fanBandTop, moved });
		}
	};
	const onCardUp = (e: ThreeEvent<PointerEvent>) => {
		const d = dragRef.current;
		if (!d || !coarse) return;
		e.stopPropagation();
		setCapture(e, false);
		const p = project(e);
		// Decide from the RELEASE point (not just the tracked `lifted` flag), so a drag resolves even if the
		// intermediate move events didn't stream: releasing past the hand's top edge = dragged out.
		const pastHand = !!p && p[1] > fanBandTop;
		const moved = !!p && !!startRef.current && Math.hypot(p[0] - startRef.current[0], p[1] - startRef.current[1]) > TOUCH_DRAG.moveThreshold;
		setDragState(null);
		startRef.current = null;
		const view = viewByKey.get(d.key);
		if (d.mode === "place") {
			if (moved && pastHand && view) {
				// DRAGGED out of the hand (a real move, not a tap on the lifted card):
				if (view.def.kind === "movement") {
					// A split card can't auto-place (it needs a chosen half): dragging it out just selects it —
					// it returns to the hand lifted, waiting for a tap on one of its two halves to play it.
					setHoveredKey(view.key);
				} else {
					// Regular card: place it. Honour the slot under the finger if over a zone, else the first
					// free slot (first, then second).
					const slot: Slot = d.slot ?? (state[viewerTeam].placed.first ? "second" : "first");
					if (!state[viewerTeam].placed[slot]) {
						dispatch({ type: "PLACE_CARD", slot, cardId: view.cardId, side: null });
						cancelRelease();
						setHoveredKey(null);
					} else {
						setHoveredKey(view.key);
					}
				}
			} else if (moved && view) {
				// browsed within the fan but didn't leave it → just keep the last card selected (armed)
				setHoveredKey(view.key);
			} else if (view) {
				// a TAP (no movement, even on a lifted card that sits above the hand): two-tap model — first tap
				// arms/lifts, second confirms. A movement card plays the pressed half (`d.side`); regular → null.
				place(view, d.side);
			}
		} else if (d.overHand && view?.slot) {
			dispatch({ type: "UNPLACE_CARD", slot: view.slot });
			cancelRelease();
			setHoveredKey(null);
		} else {
			setHoveredKey(null);
		}
	};

	// Touch: tapping empty space drops an armed (lifted) card — a "changed my mind" escape. A large
	// invisible plane BEHIND every card catches taps that miss a card; cards stopPropagation on tap, so
	// this only fires on a true miss. Only mounted while something is armed, so it never interferes
	// otherwise. (R3F disposes the inline material; the gotcha is only `new THREE.Material` via a prop.)
	const deselect = () => {
		cancelRelease();
		setHoveredKey(null);
	};

	return (
		<group>
			{coarse && hoveredKey && (
				<mesh position={[0, viewport.centerY, -2]} onClick={deselect}>
					<planeGeometry args={[viewport.width * 3, viewport.height * 3]} />
					<meshBasicMaterial transparent opacity={0} depthWrite={false} />
				</mesh>
			)}
			{items.map(({ view, target, entry, exit, hitAnchor, hit, renderBias }) => (
				<HandCard
					key={view.key}
					view={view}
					target={target}
					entry={entry}
					exit={exit}
					hitAnchor={hitAnchor}
					hit={hit}
					renderBias={renderBias}
					active={view.key === hoveredKey}
					coarse={coarse}
					// Touch + portrait: every card gets drag-and-drop. Regular cards start the drag from the whole
					// face (`onPointerDown`); movement cards start it per half (`onSideDown`) so a tap knows which
					// side to play. Landscape keeps the tap model (no landing zones there).
					drag={
						coarse && portrait
							? { onPointerDown: startDrag(view, null), onPointerMove: onCardMove, onPointerUp: onCardUp, onSideDown: (side, e) => startDrag(view, side)(e) }
							: undefined
					}
					onHover={() => hover(view.key)}
					onHoverEnd={() => endHover(view.key)}
					onPlace={(side) => place(view, side)}
					onUnplace={() => unplace(view)}
				/>
			))}
		</group>
	);
};
