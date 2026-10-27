import { useCallback, useEffect, useRef, useLayoutEffect, useMemo } from "react";
import { gsap } from "gsap";
import * as THREE from "three";
import type { Stance, Team } from "../../../game";
import { PAPER_CUTOUT, PAWN, SLASH, RESOLUTION, rakeLine } from "../../../layout";
import { useCharacterTexture, makeCharacterMaterial } from "../../../hooks/useCharacterTextures";
import type { SlashControls } from "../../../hooks/useSlashControls";
import type { PaperCutoutControls } from "../../../hooks/usePaperCutoutControls";

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
	const c = document.createElement("canvas");
	c.width = 128;
	c.height = 32;
	const g = c.getContext("2d")!;
	const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
	grad.addColorStop(0, "rgba(0,0,0,1)");
	grad.addColorStop(0.45, "rgba(0,0,0,0.55)");
	grad.addColorStop(1, "rgba(0,0,0,0)");
	// Squash the round gradient into a flat ellipse filling the 128×32 canvas.
	g.setTransform(1, 0, 0, 0.25, 0, 0);
	g.fillStyle = grad;
	g.fillRect(0, 0, 128, 128);
	shadowTexture = new THREE.CanvasTexture(c);
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
}

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
}: PawnProps) => {
	const cfg: SlashControls = slash ?? SLASH;
	const paper: PaperCutoutControls = cutout ?? PAPER_CUTOUT;
	const rootRef = useRef<THREE.Group>(null); // movement (x)
	const reactRef = useRef<THREE.Group>(null); // hit shake / punch + entrance (local)
	const meshRefs = { heaven: useRef<THREE.Mesh>(null), earth: useRef<THREE.Mesh>(null) };
	const slashRef = useRef<THREE.Mesh>(null);
	const growRef = useRef<THREE.Group>(null); // pivot group scaled to "grow" the wedge from its tip
	const hingeRef = useRef<THREE.Group>(null); // pivot at the feet: the cut-out lies down / stands up here
	const shadowRef = useRef<THREE.Mesh>(null);
	const rimRefs = { heaven: useRef<THREE.Mesh>(null), earth: useRef<THREE.Mesh>(null) };
	const edgeRefs = { heaven: useRef<THREE.Mesh>(null), earth: useRef<THREE.Mesh>(null) };
	const initialized = useRef(false);
	const prevDamage = useRef(damage);
	const prevStance = useRef<Stance | null>(null);

	const texHeaven = useCharacterTexture(team, "heaven");
	const texEarth = useCharacterTexture(team, "earth");
	const matHeaven = useMemo(() => makeCharacterMaterial(texHeaven), [texHeaven]);
	const matEarth = useMemo(() => makeCharacterMaterial(texEarth), [texEarth]);
	const materials = useMemo(() => ({ heaven: matHeaven, earth: matEarth }), [matHeaven, matEarth]);
	useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);
	// Paper layers behind the coloured silhouette: a cream rim (the cut paper's margin) and a faint
	// dark offset copy (the sheet's thickness lifting off the background).
	const rimMats = useMemo(() => ({ heaven: makeCharacterMaterial(texHeaven), earth: makeCharacterMaterial(texEarth) }), [texHeaven, texEarth]);
	const edgeMats = useMemo(() => ({ heaven: makeCharacterMaterial(texHeaven), earth: makeCharacterMaterial(texEarth) }), [texHeaven, texEarth]);
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
				const { y, z } = rakeLine(linePos, tilt);
				rootRef.current.position.set(lateral, y + lift, z);
			}
			initialized.current = true;
		}
	}, [linePos, lateral, lift, axis, tilt]);

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
			const { y, z } = rakeLine(linePos, tilt);
			gsap.to(root.position, { x: lateral, y: y + lift, z, duration, delay, ease: "power2.out", overwrite: true });
		}
	}, [linePos, moveKey, lateral, lift, axis, tilt, moveDelay, moveDur]);

	// Entrance — the paper cut-out stands up: hinged at the feet, it lies back flat on the floor
	// (`lieAngle`) until `standing`, then springs upright with an elastic recoil (overshoots
	// forward, wobbles, settles) while its contact shadow fades in. Plays once per mount; the Leva
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
		// Two beats, so the rise itself is SEEN (a single elastic ease snaps upright in its first
		// ~15% and only wobbles): a smooth lift that swings a little PAST vertical (forward), then
		// the paper's recoil — an elastic settle back to upright.
		const lift = paper.standDur * paper.liftShare;
		gsap.killTweensOf(h.rotation);
		gsap
			.timeline({ delay })
			.to(h.rotation, { x: paper.overshoot, duration: lift, ease: "power2.out" })
			.to(h.rotation, { x: 0, duration: paper.standDur - lift, ease: `elastic.out(${paper.amplitude}, ${paper.period})` });
		const sm = shadowMatOf();
		if (sm) gsap.to(sm, { opacity: paper.shadowOpacity, duration: paper.standDur * 0.5, delay, ease: "power2.out", overwrite: true });
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
	const prevStandTick = useRef(standTick);
	useEffect(() => {
		if (standTick === prevStandTick.current) return;
		prevStandTick.current = standTick;
		layDown();
		standUp(standDelay + 0.25);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [standTick]);

	// Hit reaction (when this pawn takes a point): a horizontal shake + white flash, and a yellow
	// sword-cut that sweeps across the figure — echoing the slash on the cards. Translation + opacity.
	useEffect(() => {
		if (damage > prevDamage.current) {
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
			const flash = { r: target.r, g: target.g, b: target.b, duration: 0.6, delay: attackDelay, ease: "power2.out" };
			STANCES.forEach((s) => {
				const color = matOf(s)?.color;
				if (color) gsap.fromTo(color, { r: 1, g: 1, b: 1 }, { ...flash });
			});
			gsap.delayedCall(attackDelay, playSlash); // yellow sword-cut over the struck pawn, after movement
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
					<group scale={[mirror, 1, 1]}>
						{STANCES.map((s, i) => {
							const { worldW, worldH, offsetX, centerY } = frameLayout(s, height, baseY, yLift);
							const y = centerY - (baseY + yLift); // relative to the hinge (feet)
							const zi = -i * 0.002;
							return (
								<group key={s}>
									{/* Sheet thickness: a faint dark copy, offset down-right, furthest back. */}
									<mesh ref={edgeRefs[s]} position={[offsetX + paper.edgeOffsetX * mirror, y + paper.edgeOffsetY, zi - 0.006]} material={edgeMats[s]} renderOrder={PAWN.renderOrder - 2}>
										<planeGeometry args={[worldW, worldH]} />
									</mesh>
									{/* Paper rim: the silhouette scaled up in cream — the cut-out's margin. */}
									<mesh ref={rimRefs[s]} position={[offsetX, y, zi - 0.003]} scale={[paper.rimScale, paper.rimScale, 1]} material={rimMats[s]} renderOrder={PAWN.renderOrder - 1}>
										<planeGeometry args={[worldW, worldH]} />
									</mesh>
									<mesh ref={meshRefs[s]} position={[offsetX, y, zi]} material={materials[s]} renderOrder={PAWN.renderOrder}>
										<planeGeometry args={[worldW, worldH]} />
									</mesh>
								</group>
							);
						})}
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
