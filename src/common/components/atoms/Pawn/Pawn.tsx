import { useCallback, useEffect, useRef, useLayoutEffect, useMemo } from "react";
import { gsap } from "gsap";
import * as THREE from "three";
import type { Stance, Team } from "../../../game";
import { PAWN, SLASH, RESOLUTION, rakeLine } from "../../../layout";
import { useCharacterTexture, makeCharacterMaterial } from "../../../hooks/useCharacterTextures";
import type { SlashControls } from "../../../hooks/useSlashControls";

// Tints applied to the white silhouette (multiply), matched to the duel-card palette.
const COLORS: Record<Team, string> = { red: "#cf463f", blue: "#4a8aa0" };
const INJURED: Record<Team, string> = { red: "#8c2e29", blue: "#2f5a69" };
// Hit twice = defeated → the silhouette blacks out.
const DEFEATED = "#333333";

/** Silhouette tint by health: full colour → injured → blacked-out on the killing (2nd) hit. */
const tintFor = (team: Team, damage: number): string => (damage >= 2 ? DEFEATED : damage >= 1 ? INJURED[team] : COLORS[team]);

const STANCES: Stance[] = ["heaven", "earth"];

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
}: PawnProps) => {
	const cfg: SlashControls = slash ?? SLASH;
	const rootRef = useRef<THREE.Group>(null); // movement (x)
	const reactRef = useRef<THREE.Group>(null); // hit shake / punch + entrance (local)
	const meshRefs = { heaven: useRef<THREE.Mesh>(null), earth: useRef<THREE.Mesh>(null) };
	const slashRef = useRef<THREE.Mesh>(null);
	const growRef = useRef<THREE.Group>(null); // pivot group scaled to "grow" the wedge from its tip
	const initialized = useRef(false);
	const prevDamage = useRef(damage);
	const prevStance = useRef<Stance | null>(null);

	const texHeaven = useCharacterTexture(team, "heaven");
	const texEarth = useCharacterTexture(team, "earth");
	const matHeaven = useMemo(() => makeCharacterMaterial(texHeaven), [texHeaven]);
	const matEarth = useMemo(() => makeCharacterMaterial(texEarth), [texEarth]);
	const materials = useMemo(() => ({ heaven: matHeaven, earth: matEarth }), [matHeaven, matEarth]);
	useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);

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
		const incoming = matOf(stance);
		const outgoing = matOf(stance === "heaven" ? "earth" : "heaven");
		if (!incoming || !outgoing) return;
		if (prevStance.current === null || prevStance.current === stance) {
			incoming.opacity = 1;
			outgoing.opacity = 0;
		} else {
			// `stanceDelay` holds the flip until after the strike (Kesa/Zan-Tetsu). During the delay the
			// outgoing pose stays at opacity 1 (its `to` hasn't started) while the incoming starts at 0
			// (immediateRender), so the attack reads in the pre-switch pose; the crossfade then plays.
			const delay = stanceDelay;
			gsap.to(outgoing, { opacity: 0, duration: 0.28, delay, ease: "power2.out", overwrite: true });
			gsap.fromTo(incoming, { opacity: 0 }, { opacity: 1, duration: 0.32, delay, ease: "power2.out", overwrite: true });
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
	}, [stance, materials]);

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

	// One-time entrance: slide in horizontally from each samurai's own side (red from the left, blue
	// from the right) and fade in (translation + opacity, no scale), just after the board line draws.
	useLayoutEffect(() => {
		const g = reactRef.current;
		if (!g) return;
		const fromX = team === "red" ? -0.8 : 0.8;
		gsap.from(g.position, { x: fromX, duration: 0.7, delay: 0.55, ease: "back.out(1.4)", overwrite: true });
		const mat = matOf(stance);
		if (mat) gsap.from(mat, { opacity: 0, duration: 0.6, delay: 0.55, ease: "power2.out", overwrite: true });
		// Mount-only; matOf reads stable refs and `team`/`stance` are the initial values.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

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
				<group scale={[mirror, 1, 1]}>
					{STANCES.map((s, i) => {
						const { worldW, worldH, offsetX, centerY } = frameLayout(s, height, baseY, yLift);
						return (
							<mesh key={s} ref={meshRefs[s]} position={[offsetX, centerY, baseZ + z - i * 0.002]} material={materials[s]} renderOrder={PAWN.renderOrder}>
								<planeGeometry args={[worldW, worldH]} />
							</mesh>
						);
					})}
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
