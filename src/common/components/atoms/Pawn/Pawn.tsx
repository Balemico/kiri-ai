import { useCallback, useEffect, useRef, useLayoutEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { gsap } from "gsap";
import * as THREE from "three";
import type { Stance, Team } from "../../../game";
import { PAPER_CUTOUT, PAWN, SLASH, RESOLUTION, rakeLine } from "../../../layout";
import { useCharacterTexture, makeCharacterMaterial } from "../../../hooks/useCharacterTextures";
import type { SlashControls } from "../../../hooks/useSlashControls";
import type { PaperCutoutControls } from "../../../hooks/usePaperCutoutControls";
import { cutOf, syncCutLayer, withCut } from "../../../pawnCut";

// Tints applied to the white silhouette (multiply), matched to the duel-card palette.
const COLORS: Record<Team, string> = { red: "#cf463f", blue: "#4a8aa0" };
const INJURED: Record<Team, string> = { red: "#8c2e29", blue: "#2f5a69" };
// Hit twice = defeated → the silhouette blacks out.
const DEFEATED = "#333333";

/** Silhouette tint by health: full colour → injured → blacked-out on the killing (2nd) hit. */
const tintFor = (team: Team, damage: number): string => (damage >= 2 ? DEFEATED : damage >= 1 ? INJURED[team] : COLORS[team]);

const STANCES: Stance[] = ["heaven", "earth"];

// Soft elliptical contact shadow (shared, procedural — no asset).
let shadowTexture: THREE.CanvasTexture | null = null;
const contactShadow = (): THREE.CanvasTexture => {
	if (shadowTexture) return shadowTexture;
	const W = 256;
	const H = 64;
	const c = document.createElement("canvas");
	c.width = W;
	c.height = H;
	const g = c.getContext("2d")!;
	// One gaussian blob (exp(-k·r²), sampled into many stops so no ring/knee shows), radius `r`
	// as a fraction of the half-width, peak alpha `a`.
	const blob = (r: number, a: number, k: number) => {
		const R = (W / 2) * r;
		const grad = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, R);
		for (let i = 0; i <= 16; i++) {
			const t = i / 16;
			// Normalised so the curve reaches exactly 0 at the rim (no clipped edge).
			const v = (Math.exp(-k * t * t) - Math.exp(-k)) / (1 - Math.exp(-k));
			grad.addColorStop(t, `rgba(0,0,0,${(a * v).toFixed(4)})`);
		}
		g.fillStyle = grad;
		g.fillRect(0, 0, W, W);
	};
	// Squash the round gradients into a flat ellipse filling the W×H canvas.
	g.setTransform(1, 0, 0, H / W, 0, 0);
	blob(1, 0.55, 3); // wide, faint penumbra
	blob(0.55, 0.6, 4); // denser core right under the feet
	shadowTexture = new THREE.CanvasTexture(c);
	shadowTexture.colorSpace = THREE.SRGBColorSpace;
	return shadowTexture;
};

export interface PawnProps {
	/** Position ALONG the duel line (already mapped from a board space): world-x in landscape, world-y
	 *  in portrait (see `axis`). This is the coordinate that animates as the pawn moves. */
	linePos: number;
	/** Viewport-INDEPENDENT logical line coordinate (line at unit length). Changes only on a real move
	 *  or a portrait side-swap — NOT on a window resize (which only rescales the line). Used to decide
	 *  whether to animate (logical change) or snap (pure layout change), so the pawn never lags the line
	 *  while resizing. Defaults to `linePos` (always animate) when not supplied. */
	moveKey?: number;
	/** Which world axis the line runs along: "x" (landscape, horizontal) or "y" (portrait, vertical). */
	axis?: "x" | "y";
	/** Portrait rake (radians): the duel line's tilt onto the floor plane. The pawn's line position is
	 *  laid onto this plane (y foreshortened, z receding) so it stands in perspective. */
	tilt?: number;
	/** Portrait: extra world-Y nudge of the pawn (only), to seat its feet on its diamond. */
	lift?: number;
	/** Constant offset on the cross axis (portrait: the pawn's lateral x, right of the line for the
	 *  turn player, left for the opponent). Ignored in landscape (the line fills the cross axis). It
	 *  also sets the portrait facing — the figure is mirrored to point its sword toward the line. */
	lateral?: number;
	team: Team;
	stance: Stance;
	damage: 0 | 1 | 2;
	baseY: number;
	/** Portrait: world-Y centre of the raked line the pawn moves along (see `rakeLine`). */
	lineY?: number;
	baseZ?: number;
	/** Sprite metrics (from the "Pawn" Leva folder); default to the layout constants. */
	height?: number;
	yLift?: number;
	z?: number;
	/** Sword-cut effect config (from the "Slash" Leva folder); defaults to the layout constant. */
	slash?: SlashControls;
	/** Bumping this number replays the slash (the Leva "Play" button); ignored on mount. */
	slashTick?: number;
	/** Stance of the attacker who struck this pawn — sets the cut's vertical direction (heaven = top→
	 *  bottom, earth = bottom→top). Defaults to this pawn's own stance. */
	attackerStance?: Stance;
	/** Staged-resolution timing: delay before this pawn's slide starts (lower priority waits), the
	 *  slide duration, and the delay before its hit reaction fires (so attacks land after movement). */
	moveDelay?: number;
	moveDur?: number;
	attackDelay?: number;
	/** Delay (s) before the stance crossfade plays — used to hold a Kesa/Zan-Tetsu flip until AFTER the
	 *  strike, so the attack reads in its pre-switch pose. Defaults to 0 (switch immediately). */
	stanceDelay?: number;
	/** Paper cut-out look + stand-up entrance (from the "Paper Cutout" Leva folder). */
	cutout?: PaperCutoutControls;
	/** False = the cut-out lies back flat on the floor; flipping true springs it up (once). */
	standing?: boolean;
	/** Seconds before this figure springs up (the second samurai follows the first). */
	standDelay?: number;
	/** Bumping this lays the figure back down and replays the spring-up (Leva "play stand-up"). */
	standTick?: number;
	/** True = defeated: the cut-out falls back flat onto the floor — the stand-up played in reverse. */
	fallen?: boolean;
	/** Seconds before the fall starts (lets the killing blow land first). */
	fallDelay?: number;
	/** Bumping this previews the fall, then raises the figure again (Leva "play fall"). */
	fallTick?: number;
	/** Bumping this replays the hit sway right away (Leva "Game HUD → ▶ Play hit"). */
	hitTick?: number;
	/** Draw-band bias (`PAWN.stack`): higher = this whole cut-out paints over the other one. */
	stack?: number;
}

/** renderOrder of one cut-out layer (0 edge, 1 rim, 2 silhouette) inside its stack band. */
const layerOrder = (layer: number, stack: number): number => PAWN.renderOrder - 1 + stack + layer * 0.1;

/** Geometry of one stance sprite, anchored by body column + feet so it stands on the board line. */
const frameLayout = (stance: Stance, height: number, baseY: number, yLift: number) => {
	const frame = stance === "heaven" ? PAWN.frames.heaven : PAWN.frames.earth;
	const worldH = height * frame.scale; // per-stance scale so the two poses read at the same size
	const worldW = worldH * frame.aspect;
	const offsetX = -(frame.bodyCol - 0.5) * worldW; // mirroring is handled by the parent group
	const centerY = baseY + worldH * (frame.feetRow - 0.5) + yLift;
	return { worldW, worldH, offsetX, centerY };
};

/** A samurai pawn: two stance silhouettes crossfaded into each other, tinted, with a hit reaction. */
export const Pawn = ({
	linePos,
	moveKey = linePos,
	axis = "x",
	tilt = 0,
	lift = 0,
	lateral = 0,
	team,
	stance,
	damage,
	baseY,
	lineY = 0,
	baseZ = 0,
	height = PAWN.height,
	yLift = PAWN.yLift,
	z = PAWN.z,
	slash,
	slashTick = 0,
	attackerStance,
	moveDelay = 0,
	moveDur = RESOLUTION.moveDur,
	attackDelay = 0,
	stanceDelay = 0,
	cutout,
	standing = true,
	standDelay = 0,
	standTick = 0,
	fallen = false,
	fallDelay = 0,
	fallTick = 0,
	hitTick = 0,
	stack = PAWN.stack.front,
}: PawnProps) => {
	const cfg: SlashControls = slash ?? SLASH;
	const paper: PaperCutoutControls = cutout ?? PAPER_CUTOUT;
	const rootRef = useRef<THREE.Group>(null); // movement (x)
	const reactRef = useRef<THREE.Group>(null); // hit shake / punch + entrance (local)
	const meshRefs = { heaven: useRef<THREE.Mesh>(null), earth: useRef<THREE.Mesh>(null) };
	const slashRef = useRef<THREE.Mesh>(null);
	const growRef = useRef<THREE.Group>(null); // pivot group scaled to "grow" the wedge from its tip
	const hingeRef = useRef<THREE.Group>(null); // pivot at the feet: the cut-out lies down / stands up here
	const swayRef = useRef<THREE.Group>(null); // also at the feet: the hit sway (back and forth)
	const shadowRef = useRef<THREE.Mesh>(null);
	const rimRefs = { heaven: useRef<THREE.Mesh>(null), earth: useRef<THREE.Mesh>(null) };
	const edgeRefs = { heaven: useRef<THREE.Mesh>(null), earth: useRef<THREE.Mesh>(null) };
	const initialized = useRef(false);
	const prevDamage = useRef(damage);
	const prevStance = useRef<Stance | null>(null);

	const texHeaven = useCharacterTexture(team, "heaven");
	const texEarth = useCharacterTexture(team, "earth");
	// Every paper layer is cut-aware (pawnCut.ts): once struck, the figure is drawn sliced in two.
	const matHeaven = useMemo(() => withCut(makeCharacterMaterial(texHeaven)), [texHeaven]);
	const matEarth = useMemo(() => withCut(makeCharacterMaterial(texEarth)), [texEarth]);
	const materials = useMemo(() => ({ heaven: matHeaven, earth: matEarth }), [matHeaven, matEarth]);
	useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);
	// Paper layers behind the coloured silhouette: a cream rim (the cut paper's margin) and a faint
	// dark offset copy (the sheet's thickness lifting off the background).
	const rimMats = useMemo(() => ({ heaven: withCut(makeCharacterMaterial(texHeaven)), earth: withCut(makeCharacterMaterial(texEarth)) }), [texHeaven, texEarth]);
	const edgeMats = useMemo(() => ({ heaven: withCut(makeCharacterMaterial(texHeaven)), earth: withCut(makeCharacterMaterial(texEarth)) }), [texHeaven, texEarth]);
	useEffect(() => () => STANCES.forEach((st) => rimMats[st].dispose()), [rimMats]);
	useEffect(() => () => STANCES.forEach((st) => edgeMats[st].dispose()), [edgeMats]);
	const shadowMat = useMemo(
		() => new THREE.MeshBasicMaterial({ map: contactShadow(), color: "#000000", transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false }),
		[],
	);
	useEffect(() => () => shadowMat.dispose(), [shadowMat]);

	// vertexColors lets the 3 triangle vertices carry per-vertex alpha → a smooth tip→base gradient.
	const slashMat = useMemo(
		() =>
			new THREE.MeshBasicMaterial({
				color: cfg.color,
				vertexColors: true,
				transparent: true,
				opacity: 0,
				toneMapped: false,
				depthTest: false,
				depthWrite: false,
				side: THREE.DoubleSide,
			}),
		[cfg.color],
	);
	useEffect(() => () => slashMat.dispose(), [slashMat]);

	// Bold triangular sword-cut wedge — a solid triangle (tip + flat base), like the yellow shard on
	// the cards. Long axis = Y, centred on its centroid. Per-vertex alpha (tip opaque, base faded by
	// `baseFade`) gives a soft, non-hard base; the RGB stays white so material.color tints it.
	const slashGeometry = useMemo(() => {
		const L = height * cfg.lengthScale; // tip-to-base length
		const w = height * cfg.widthScale; // base width
		const cy = -L / 6; // centroid of the triangle, so it sweeps about its centre
		const baseAlpha = 1 - cfg.baseFade;
		const geo = new THREE.BufferGeometry();
		// prettier-ignore
		geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
			0, L / 2 - cy, 0,        // tip
			w / 2, -L / 2 - cy, 0,   // base right
			-w / 2, -L / 2 - cy, 0,  // base left
		]), 3));
		// prettier-ignore
		geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array([
			1, 1, 1, 1,              // tip — opaque
			1, 1, 1, baseAlpha,      // base right — faded
			1, 1, 1, baseAlpha,      // base left — faded
		]), 4));
		return geo;
	}, [height, cfg.lengthScale, cfg.widthScale, cfg.baseFade]);
	useEffect(() => () => slashGeometry.dispose(), [slashGeometry]);

	// Play the sword-cut: the wedge is "born" by growing from its tip to its base (scale on the pivot
	// group, anchored at the tip) while fading in, then it fades out. Translation-free.
	const playSlash = useCallback(() => {
		const grow = growRef.current;
		const smat = slashRef.current?.material as THREE.MeshBasicMaterial | undefined;
		if (!grow || !smat) return;
		const outStart = Math.max(cfg.inDur, cfg.growDur - cfg.outDur);
		gsap.killTweensOf(grow.scale);
		gsap.killTweensOf(smat);
		gsap
			.timeline()
			.set(grow.scale, { x: 0, y: 0, z: 1 })
			.set(smat, { opacity: 0 })
			.to(grow.scale, { x: 1, y: 1, duration: cfg.growDur, ease: "power2.out" }, 0)
			.to(smat, { opacity: cfg.opacity, duration: cfg.inDur, ease: "power2.out" }, 0)
			.to(smat, { opacity: 0, duration: cfg.outDur, ease: "power2.in" }, outStart);
	}, [cfg]);

	// Landscape: red faces right (source facing), blue is mirrored — both look inward toward the
	// opponent. Portrait: the two pawns sit on opposite sides of the vertical line, so facing is set by
	// the lateral side (the right pawn faces left, the left pawn faces right) — sword toward the line.
	const mirror = axis === "y" ? (lateral > 0 ? -1 : 1) : team === "red" ? 1 : -1;
	const baseColor = tintFor(team, damage);

	// Sword-cut placement + mirrors: centred on the figure; flipped per team (x) and per attacker
	// stance (y) — heaven strikes one way (−1), earth the other (+1).
	const slashCenterY = baseY + height * 0.45;
	const slashCenterZ = baseZ + z + 0.06;
	const stanceSign = (attackerStance ?? stance) === "heaven" ? -1 : 1;
	// The wedge's tip in the (un-rotated) blade frame; the pivot group sits here so growth/scale is
	// anchored at the tip, and the mesh is shifted back so the full-scale result stays centred.
	const tipLocalY = (height * cfg.lengthScale * 2) / 3; // = L/2 − centroid(−L/6)

	// Mutate materials through the mesh refs (refs are mutable; the useMemo'd materials are not).
	const matOf = (s: Stance) => meshRefs[s].current?.material as THREE.MeshBasicMaterial | undefined;
	const rimOf = (s: Stance) => rimRefs[s].current?.material as THREE.MeshBasicMaterial | undefined;
	const edgeOf = (s: Stance) => edgeRefs[s].current?.material as THREE.MeshBasicMaterial | undefined;
	/** Every layer of a stance's cut-out with its full opacity — the stance crossfade moves them together. */
	const layersOf = (s: Stance): [THREE.MeshBasicMaterial | undefined, number][] => [
		[matOf(s), 1],
		[rimOf(s), 1],
		[edgeOf(s), paper.edgeOpacity],
	];

	// Paper colours (rim cream, edge ink) — kept in sync with the controls.
	useLayoutEffect(() => {
		STANCES.forEach((st) => {
			rimOf(st)?.color.set(paper.rimColor);
			edgeOf(st)?.color.set("#000000");
		});
		// rimOf/edgeOf read stable refs.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [rimMats, edgeMats, paper.rimColor]);

	// Keep the tint in sync before paint (no white flash on mount or material swap).
	useLayoutEffect(() => {
		matOf("heaven")?.color.set(baseColor);
		matOf("earth")?.color.set(baseColor);
		// matOf reads stable refs; materials in deps so the tint re-applies after a material swap.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [materials, baseColor]);

	// Crossfade the two stance sprites: on a stance change, the outgoing pose fades out while the
	// incoming one fades in with a small scale overshoot + a vertical settle. On mount it just snaps.
	useLayoutEffect(() => {
		const other: Stance = stance === "heaven" ? "earth" : "heaven";
		if (!matOf(stance) || !matOf(other)) return;
		if (prevStance.current === null || prevStance.current === stance) {
			layersOf(stance).forEach(([m, full]) => {
				if (m) m.opacity = full;
			});
			layersOf(other).forEach(([m]) => {
				if (m) m.opacity = 0;
			});
		} else {
			// `stanceDelay` holds the flip until after the strike (Kesa/Zan-Tetsu). During the delay the
			// outgoing pose stays at opacity 1 (its `to` hasn't started) while the incoming starts at 0
			// (immediateRender), so the attack reads in the pre-switch pose; the crossfade then plays.
			const delay = stanceDelay;
			layersOf(other).forEach(([m]) => m && gsap.to(m, { opacity: 0, duration: 0.28, delay, ease: "power2.out", overwrite: true }));
			layersOf(stance).forEach(([m, full]) => m && gsap.fromTo(m, { opacity: 0 }, { opacity: full, duration: 0.32, delay, ease: "power2.out", overwrite: true }));
			// Directional settle (translation only): the figure lifts when rising to heaven, sinks to earth.
			const from = stance === "heaven" ? -0.05 : 0.05;
			if (reactRef.current)
				gsap.fromTo(
					reactRef.current.position,
					{ y: from },
					{ y: 0, duration: 0.45, delay, ease: "power2.out", overwrite: "auto", immediateRender: false },
				);
		}
		prevStance.current = stance;
		// matOf/meshRefs/reactRef are stable refs; intentionally not dependencies.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [stance, materials, rimMats, edgeMats, paper.edgeOpacity]);

	// Movement along the line: landscape slides along x. Portrait lays the line position onto the
	// raked board plane (y foreshortened + z receding, via `rakeLine`) so the pawn stands in
	// perspective on the floor; the lateral side (x) is a constant that just snaps on a turn flip.
	useLayoutEffect(() => {
		if (rootRef.current && !initialized.current) {
			if (axis === "x") rootRef.current.position.set(linePos, 0, 0);
			else {
				const { y, z } = rakeLine(linePos, tilt, lineY);
				rootRef.current.position.set(lateral, y + lift, z);
			}
			initialized.current = true;
		}
	}, [linePos, lateral, lift, axis, tilt, lineY]);

	const prevMoveKey = useRef(moveKey);
	const prevAxis = useRef(axis);
	useEffect(() => {
		const root = rootRef.current;
		if (!root || !initialized.current) return;
		// Animate only when the LOGICAL position changes (a move or a portrait side-swap). A pure layout
		// change — a window resize rescales the line, or the orientation flips the whole axis — must SNAP,
		// otherwise the pawn chases the (already moved) line/diamonds on a 0.6s tween and reads dislocated.
		const axisChanged = prevAxis.current !== axis;
		const animate = !axisChanged && prevMoveKey.current !== moveKey;
		prevMoveKey.current = moveKey;
		prevAxis.current = axis;
		const duration = animate ? moveDur : 0;
		const delay = animate ? moveDelay : 0;
		// Always set ALL THREE coordinates: on an orientation flip the axes swap, so a branch that only
		// drives its own axis would leave the OTHER two at their stale (previous-orientation) values —
		// e.g. a pawn keeping its tall portrait Y after switching to landscape, stranded up in the scenery.
		if (axis === "x") {
			gsap.to(root.position, { x: linePos, y: 0, z: 0, duration, delay, ease: "power2.out", overwrite: true });
		} else {
			const { y, z } = rakeLine(linePos, tilt, lineY);
			gsap.to(root.position, { x: lateral, y: y + lift, z, duration, delay, ease: "power2.out", overwrite: true });
		}
	}, [linePos, moveKey, lateral, lift, axis, tilt, lineY, moveDelay, moveDur]);

	// Entrance — the paper cut-out stands up: hinged at the feet, it lies back flat on the floor
	// (`lieAngle`) until `standing`, then is raised slowly, like a paper-theatre figure, while its
	// contact shadow fades in. Plays once per mount; the Leva
	// "play stand-up" (`standTick`) lays it back down and replays it.
	const stood = useRef(false);
	const shadowMatOf = () => shadowRef.current?.material as THREE.MeshBasicMaterial | undefined;
	const layDown = () => {
		if (hingeRef.current) hingeRef.current.rotation.x = paper.lieAngle;
		const sm = shadowMatOf();
		if (sm) sm.opacity = 0;
	};
	const standUp = (delay: number) => {
		const h = hingeRef.current;
		if (!h) return;
		// Paper theatre: raised slowly by an unseen hand — a long sine-eased lift that drifts just past
		// vertical, then one soft ease back into place (no spring, no wobble).
		const lift = paper.standDur * paper.liftShare;
		gsap.killTweensOf(h.rotation);
		gsap
			.timeline({ delay })
			.to(h.rotation, { x: paper.overshoot, duration: lift, ease: "sine.inOut" })
			.to(h.rotation, { x: 0, duration: paper.standDur - lift, ease: "sine.inOut" });
		const sm = shadowMatOf();
		if (sm) gsap.to(sm, { opacity: paper.shadowOpacity, duration: paper.standDur * paper.liftShare, delay, ease: "sine.inOut", overwrite: true });
	};
	useLayoutEffect(() => {
		if (!standing) layDown();
		else {
			stood.current = true;
			const sm = shadowMatOf();
			if (sm) sm.opacity = paper.shadowOpacity;
		}
		// Mount-only: the initial pose.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	useEffect(() => {
		if (!standing || stood.current) return;
		stood.current = true;
		standUp(standDelay);
		// standUp reads refs + the live controls.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [standing]);
	// Defeat — the stand-up in reverse: the soft settle undone (a drift just past vertical), then the
	// long sine-eased fall back flat onto the floor, the contact shadow fading with it. A new duel
	// (fallen → false) raises the figure again.
	const fallDown = (delay: number) => {
		const h = hingeRef.current;
		if (!h) return;
		const lift = paper.standDur * paper.liftShare;
		gsap.killTweensOf(h.rotation);
		gsap
			.timeline({ delay })
			.to(h.rotation, { x: paper.overshoot, duration: paper.standDur - lift, ease: "sine.inOut" })
			.to(h.rotation, { x: paper.lieAngle, duration: lift, ease: "sine.inOut" });
		const sm = shadowMatOf();
		if (sm) gsap.to(sm, { opacity: 0, duration: lift, delay: delay + (paper.standDur - lift), ease: "sine.inOut", overwrite: true });
	};
	const wasFallen = useRef(fallen);
	useEffect(() => {
		if (fallen === wasFallen.current) return;
		wasFallen.current = fallen;
		if (fallen) fallDown(fallDelay);
		else standUp(0);
		// fallDown/standUp read refs + the live controls.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fallen]);
	// Leva "play fall": fall now, lie a beat, then stand back up so it can be replayed.
	const prevFallTick = useRef(fallTick);
	useEffect(() => {
		if (fallTick === prevFallTick.current) return;
		prevFallTick.current = fallTick;
		fallDown(0);
		const back = gsap.delayedCall(paper.standDur + 1.2, () => standUp(0));
		return () => {
			back.kill();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fallTick]);
	const prevStandTick = useRef(standTick);
	useEffect(() => {
		if (standTick === prevStandTick.current) return;
		prevStandTick.current = standTick;
		layDown();
		standUp(standDelay + 0.25);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [standTick]);

	// The permanent cut (pawnCut.ts): at the blow a thin triangular notch is carved into the figure and
	// stays, in both stances. It comes from ABOVE on the figure's OUTER side (its back, away from the
	// opponent) and runs down into the body at `cutAngle`. The killing blow widens the same notch.
	const cut = useRef({ amount: damage >= 2 ? paper.cutDeath : damage >= 1 ? 1 : 0 });
	const openCut = (to: number, delay: number) => {
		gsap.to(cut.current, { amount: to, duration: 0.35, delay, ease: "power3.out", overwrite: true });
	};
	// Keep every layer's cut in sync each frame (layer transforms + the live Leva look are cheap to copy).
	useFrame(() => {
		const { amount } = cut.current;
		const full = paper.cutLength * height;
		// Figure space is pre-mirror with the figure facing +x (the source art), so the outer side is −x for
		// both teams and both layouts. Base → tip runs toward the front and DOWN, `cutAngle` below horizontal.
		const tx = Math.cos(paper.cutAngle);
		const ty = -Math.sin(paper.cutAngle);
		STANCES.forEach((st) => {
			[edgeRefs[st], rimRefs[st], meshRefs[st]].forEach((ref, layer) => {
				const mesh = ref.current;
				const u = mesh && cutOf(mesh.material);
				if (!mesh || !u) return;
				syncCutLayer(mesh);
				u.on.value = amount > 0.001 ? 1 : 0;
				u.point.value.set(0, height * paper.cutHeight);
				u.dir.value.set(tx, ty);
				// The wide base sits OUTSIDE the figure, high on its back (it enters from the edge already open);
				// the tip stops at the body column, mid-figure — a notch, never a split. Carved from the base, the tip running in as it opens.
				u.start.value = -full * 0.92;
				u.length.value = full * Math.min(amount, 1);
				// The coloured silhouette (layer 2) gets the wider notch → a line of paper rim along the cut.
				u.halfWidth.value = ((paper.cutWidth * amount + (layer === 2 ? paper.cutRim : 0)) * height) / 2;
			});
		});
	});

	// Hit sway: the struck cut-out totters on its feet BACK and forth (toward the floor it lies on and
	// back — as if about to fall), then settles upright in a few damped swings. Its own group inside the
	// hinge, so it composes with (never cancels) the lie/stand/fall tweens on the hinge itself.
	// While it totters the figure is drawn BEHIND the other one (its stack band dropped to `swaying`), then
	// back to its resting band once upright — so a close pair never cuts through each other.
	const applyStack = (bias: number) =>
		STANCES.forEach((st) => {
			[edgeRefs[st], rimRefs[st], meshRefs[st]].forEach((ref, layer) => {
				if (ref.current) ref.current.renderOrder = layerOrder(layer, bias);
			});
		});
	const stackRef = useRef(stack);
	useLayoutEffect(() => {
		stackRef.current = stack;
		applyStack(stack);
		// applyStack reads stable refs.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [stack]);
	const swayTl = useRef<gsap.core.Timeline | null>(null);
	useEffect(() => () => void swayTl.current?.kill(), []);
	const sway = (delay: number) => {
		const s = swayRef.current;
		if (!s) return;
		const a = -paper.swayAngle; // same sign as lieAngle = tipping backward
		const d = paper.swayDur;
		swayTl.current?.kill();
		swayTl.current = gsap
			.timeline({ delay })
			.call(() => applyStack(PAWN.stack.swaying))
			.to(s.rotation, { x: a, duration: d * 0.18, ease: "power2.out" })
			.to(s.rotation, { x: -a * 0.5, duration: d * 0.3, ease: "sine.inOut" })
			.to(s.rotation, { x: a * 0.2, duration: d * 0.26, ease: "sine.inOut" })
			.to(s.rotation, { x: 0, duration: d * 0.26, ease: "sine.out" })
			.call(() => applyStack(stackRef.current));
	};
	const prevHitTick = useRef(hitTick);
	useEffect(() => {
		if (hitTick === prevHitTick.current) return;
		prevHitTick.current = hitTick;
		sway(0);
		// Preview the cut too, then mend it (only on a figure that isn't cut for real).
		if (cut.current.amount === 0) {
			openCut(1, 0);
			gsap.to(cut.current, { amount: 0, duration: 0.3, delay: 2.4, ease: "power2.in" });
		}
		// sway reads refs + the live controls.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [hitTick]);

	// Hit reaction (when this pawn takes a point): a horizontal shake + black (sumi) flash, a sway on its feet,
	// and a yellow sword-cut that sweeps across the figure — echoing the slash on the cards.
	useEffect(() => {
		if (damage > prevDamage.current) {
			sway(attackDelay);
			const g = reactRef.current;
			if (g) {
				// `delay` holds the strike back until the movement beats have settled (attacks land last).
				gsap
					.timeline({ delay: attackDelay })
					.to(g.position, { x: 0.05, duration: 0.06 })
					.to(g.position, { x: -0.05, duration: 0.06 })
					.to(g.position, { x: 0.03, duration: 0.06 })
					.to(g.position, { x: 0, duration: 0.08, ease: "power2.out" });
			}
			const target = new THREE.Color(tintFor(team, damage));
			const ink = new THREE.Color(PAWN.hitFlash);
			// immediateRender off: the silhouette keeps its tint until the blow actually lands (the delay).
			const flash = { r: target.r, g: target.g, b: target.b, duration: 0.6, delay: attackDelay, ease: "power2.out", immediateRender: false };
			STANCES.forEach((s) => {
				const color = matOf(s)?.color;
				if (color) gsap.fromTo(color, { r: ink.r, g: ink.g, b: ink.b }, { ...flash });
			});
			gsap.delayedCall(attackDelay, playSlash); // yellow sword-cut over the struck pawn, after movement
			openCut(damage >= 2 ? paper.cutDeath : 1, attackDelay);
		}
		prevDamage.current = damage;
		// matOf reads stable refs; not a dependency.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [damage, team, materials, playSlash, attackDelay]);

	// Preview trigger: replay the slash whenever the Leva "Play" button bumps slashTick (skip mount).
	const prevTick = useRef(slashTick);
	useEffect(() => {
		if (slashTick !== prevTick.current) {
			prevTick.current = slashTick;
			playSlash();
		}
	}, [slashTick, playSlash]);

	return (
		<group ref={rootRef}>
			<group ref={reactRef}>
				{/* Contact shadow at the feet — fades in as the cut-out stands up. */}
				<mesh ref={shadowRef} position={[0, baseY + yLift, baseZ + z - 0.01]} material={shadowMat} renderOrder={PAWN.renderOrder - 3}>
					<planeGeometry args={[height * paper.shadowWidth, paper.shadowHeight]} />
				</mesh>
				{/* Hinge at the feet: the whole cut-out rotates about the floor line (lie down / stand up). */}
				<group ref={hingeRef} position={[0, baseY + yLift, baseZ + z]}>
					<group ref={swayRef}>
					<group scale={[mirror, 1, 1]}>
						{STANCES.map((s, i) => {
							const { worldW, worldH, offsetX, centerY } = frameLayout(s, height, baseY, yLift);
							const y = centerY - (baseY + yLift); // relative to the hinge (feet)
							const zi = -i * 0.002;
							return (
								<group key={s}>
									{/* Sheet thickness: a faint dark copy of the WHOLE sheet (rim included), furthest back,
									    offset toward the figure's OUTER side (its back — away from the opponent / the line), so
									    the two cut-outs mirror each other: red's thickness on the left, blue's on the right.
									    Inside the mirrored group, a constant −x local offset is exactly that in both layouts. */}
									<mesh
										ref={edgeRefs[s]}
										position={[offsetX - paper.edgeOffsetX,y + paper.rimOffsetY + paper.edgeOffsetY, zi - 0.006]}
										scale={[paper.rimScale, paper.rimScale, 1]}
										material={edgeMats[s]}
										renderOrder={layerOrder(0, stack)}
									>
										<planeGeometry args={[worldW, worldH]} />
									</mesh>
									{/* Paper rim: the silhouette scaled up in cream — the cut-out's margin. */}
									<mesh ref={rimRefs[s]} position={[offsetX, y + paper.rimOffsetY, zi - 0.003]} scale={[paper.rimScale, paper.rimScale, 1]} material={rimMats[s]} renderOrder={layerOrder(1, stack)}>
										<planeGeometry args={[worldW, worldH]} />
									</mesh>
									<mesh ref={meshRefs[s]} position={[offsetX, y, zi]} material={materials[s]} renderOrder={layerOrder(2, stack)}>
										<planeGeometry args={[worldW, worldH]} />
									</mesh>
								</group>
							);
						})}
					</group>
					</group>
				</group>
			</group>
			{/* Sword-cut overlay — centred on the figure; the mesh sweeps about this group's origin via
			    gsap (idle at opacity 0). Scale mirrors the wedge per team (x) and per attacker stance (y). */}
			<group position={[0, slashCenterY, slashCenterZ]} scale={[mirror, stanceSign, 1]}>
				{/* +π swaps the wedge's tip/base (same diagonal) so the point leads the strike correctly. */}
				<group rotation={[0, 0, cfg.angle + Math.PI]}>
					{/* Pivot at the tip: scaling this group grows the wedge from tip → base (the "birth"). */}
					<group ref={growRef} position={[0, tipLocalY, 0]}>
						<mesh ref={slashRef} geometry={slashGeometry} material={slashMat} position={[0, -tipLocalY, 0]} renderOrder={PAWN.renderOrder + 50} />
					</group>
				</group>
			</group>
		</group>
	);
};
