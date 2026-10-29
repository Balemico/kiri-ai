import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";
import * as THREE from "three";
import { BOARD_SPACES, RED_START, BLUE_START, spaceToX, type Team } from "../../../game";
import { lineCoord, portraitLateralSign, rakeLine, BATTLEFIELD_HALF_WIDTH, type Orientation } from "../../../layout";

/** Landscape x of a space on a line `length` long (the outer spaces land on its ends). */
const landscapeCoord = (space: number, length: number): number => spaceToX(space) * (length / (BATTLEFIELD_HALF_WIDTH * 2));

export interface BoardLineProps {
	y?: number;
	z?: number;
	length?: number;
	/** Rake the diamonds onto the floor (radians) — set to match the floor tilt direction. */
	diamondTilt?: number;
	/** Board space each pawn occupies — the team colour marker appears there. */
	redSpace?: number;
	blueSpace?: number;
	/** Whose turn it is — that team's marker stretches and pulses gently. `null` = no active marker. */
	current?: Team | null;
	/** Slide timing, kept in sync with the pawns so each marker travels with its samurai. */
	redMoveDelay?: number;
	blueMoveDelay?: number;
	moveDur?: number;
	/** Landscape = horizontal line (spaces along x); portrait = vertical line (spaces along y). */
	orientation?: Orientation;
	/** Portrait only: which team sits at the bottom — orients the line + lateral marker sides. */
	bottomTeam?: Team;
	/** Final size multiplier for the markers/diamonds/line-width (already viewport-proportional, set by
	 *  the Battlefield so it stays consistent across orientations). 1 = the landscape reference size. */
	markerScale?: number;
	/** Extra size multiplier for the coloured spike only (the diamond + line keep `markerScale`). */
	spikeScale?: number;
	/** The duel's closing beat: both team markers shrink away, leaving the bare white line. */
	hideMarkers?: boolean;
}

// Card-palette team colours (match the pawns / card art).
const TEAM_COLOR: Record<Team, string> = { red: "#cf463f", blue: "#4a8aa0" };

// The marker is a rhombus identical to the white battleline diamond (so while it slides it reads as a
// coloured diamond, not a stray point) plus a "spike" whose apex sits on the diamond's NEAR vertex, so
// the triangle runs UNDER the diamond (occluded there) and fades out past the far vertex — matching the
// coloured triangle on the cards. The spike fans toward that team's own side: red toward the hand (down),
// blue toward the horizon (up). The spike is team-coloured (and the only part stretched/pulsed); the
// rhombus is always WHITE like the static battleline diamonds, so they read as the same marker.
const DIAMOND = 0.05; // white-diamond box size (kept in sync with the marker mesh below)
const DIAMOND_TIP = DIAMOND * Math.SQRT1_2; // centre → rotated-diamond vertex
const SPIKE_LEN = 0.22; // spike apex (near vertex) → faded base (45° sides, so half-width = length)

// Colour rhombus matching the white diamond (two triangles, fully opaque).
const DIAMOND_GEO = (() => {
	const g = new THREE.BufferGeometry();
	const d = DIAMOND_TIP;
	// prettier-ignore
	g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
		0, d, 0,  d, 0, 0,  0, -d, 0,   // top, right, bottom
		0, d, 0,  0, -d, 0,  -d, 0, 0,  // top, bottom, left
	]), 3));
	g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(Array(6).fill([1, 1, 1, 1]).flat()), 4));
	return g;
})();

// Spike with its apex at the origin (placed on the diamond's near vertex), fanning in `dir`, fading.
const makeSpikeGeometry = (dir: number): THREE.BufferGeometry => {
	const g = new THREE.BufferGeometry();
	// prettier-ignore
	g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
		0, 0, 0,                            // apex — on the diamond vertex
		-SPIKE_LEN, dir * SPIKE_LEN, 0,     // base left  (45°)
		SPIKE_LEN, dir * SPIKE_LEN, 0,      // base right
	]), 3));
	// prettier-ignore
	g.setAttribute("color", new THREE.BufferAttribute(new Float32Array([
		1, 1, 1, 1,          // apex — opaque
		1, 1, 1, 0,          // base — transparent (fade-out)
		1, 1, 1, 0,
	]), 4));
	return g;
};
const SPIKE_GEO: Record<Team, THREE.BufferGeometry> = { red: makeSpikeGeometry(-1), blue: makeSpikeGeometry(1) };
const SPIKE_DIR: Record<Team, number> = { red: -1, blue: 1 };

// The rhombus at the spike's tip is always pure white, identical to the static battleline diamonds.
// Shared module constant (no per-instance disposal needed, like the cards' hit material). vertexColors
// is off so it ignores DIAMOND_GEO's colour attribute. It MUST be `transparent` so it shares the
// transparent render pass with the spike — otherwise (opaque) it would always draw before the transparent
// spike and the coloured apex would paint over it. With both transparent, the higher renderOrder wins.
const WHITE_DIAMOND_MAT = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false, side: THREE.DoubleSide, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });

/** A team's colour marker, sitting at its pawn's space: tip at the diamond, base fading out. It
 * slides along the line (animated) as the pawn moves; points up for the current team, down otherwise.
 * Landscape: the marker rides ON the line, spike pointing toward that team's own side (red down, blue
 * up). Portrait: the marker rides on the raked vertical line at its diamond, spike turned to point
 * laterally toward its pawn's side (bottom team → right, top team → left). */
const TeamMarker = ({ team, space, y, z, length, diamondTilt, active, moveDelay, moveDur, orientation, bottomTeam, markerScale, spikeScale, hidden }: { team: Team; space: number; y: number; z: number; length: number; diamondTilt: number; active: boolean; moveDelay: number; moveDur: number; orientation: Orientation; bottomTeam: Team; markerScale: number; spikeScale: number; hidden: boolean }) => {
	const ref = useRef<THREE.Group>(null); // slides with the pawn (x landscape, y portrait)
	const spikeRef = useRef<THREE.Group>(null); // only the spike stretches (the diamond stays put)
	const initialized = useRef(false);
	const portrait = orientation === "portrait";
	// Position along the line for the current space, on the moving axis (portrait scales to the line).
	const coord = portrait ? lineCoord(space, bottomTeam, length) : landscapeCoord(space, length);
	// Viewport-INDEPENDENT logical coordinate (line at unit length): changes only on a real move or a
	// portrait side-swap, NOT on a resize (which only rescales `length`). Drives animate-vs-snap below.
	const moveKey = portrait ? lineCoord(space, bottomTeam) : spaceToX(space);
	// Portrait: the marker stays ON the line at its diamond (like landscape), but its spike turns to
	// point laterally toward its pawn's side (bottom team → right, top team → left). φ is derived so the
	// rotated (y-fanning) spike's x-sign matches that side.
	const lateralSign = portraitLateralSign(team, bottomTeam);
	const spikeSpin = portrait ? (lateralSign === SPIKE_DIR[team] ? -Math.PI / 2 : Math.PI / 2) : 0;

	// The team-coloured material for the spike (the rhombus uses the shared white material instead);
	// disposed on unmount. polygonOffset pushes it back in DEPTH (not in space) so the white line/diamonds — at the same z,
	// hence perfectly aligned — occlude it, without a z gap that the rake would turn into a screen gap.
	const material = useMemo(
		() => new THREE.MeshBasicMaterial({ color: TEAM_COLOR[team], vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
		[team],
	);
	useEffect(() => () => material.dispose(), [material]);

	useLayoutEffect(() => {
		if (!ref.current || initialized.current) return;
		if (portrait) {
			const { y: ry, z: rz } = rakeLine(coord, diamondTilt, y, z);
			ref.current.position.set(0, ry, rz);
		} else ref.current.position.x = coord;
		initialized.current = true;
	}, [coord, portrait, diamondTilt, y, z]);
	const prevMoveKey = useRef(moveKey);
	const prevPortrait = useRef(portrait);
	useEffect(() => {
		if (!ref.current || !initialized.current) return;
		// Animate only on a logical change (move / side-swap); SNAP on a pure layout change (resize
		// rescales the line, or the orientation flips the axis) so the marker stays locked to its diamond.
		const orientationChanged = prevPortrait.current !== portrait;
		const animate = !orientationChanged && prevMoveKey.current !== moveKey;
		prevMoveKey.current = moveKey;
		prevPortrait.current = portrait;
		const duration = animate ? moveDur : 0;
		const delay = animate ? moveDelay : 0;
		// Set ALL THREE coordinates: on an orientation flip the moving axis swaps, so leaving the others
		// at their previous-orientation values would strand the marker off its line.
		if (portrait) {
			const { y: ry, z: rz } = rakeLine(coord, diamondTilt, y, z);
			gsap.to(ref.current.position, { x: 0, y: ry, z: rz, duration, delay, ease: "power2.out", overwrite: true });
		} else {
			gsap.to(ref.current.position, { x: coord, y: 0, z: 0, duration, delay, ease: "power2.out", overwrite: true });
		}
	}, [coord, moveKey, portrait, diamondTilt, y, z, moveDelay, moveDur]);

	// Entrance: grow in with a small pop, just after the diamonds have settled.
	useLayoutEffect(() => {
		if (ref.current) gsap.from(ref.current.scale, { x: 0, y: 0, z: 0, duration: 0.4, delay: 0.55, ease: "back.out(2)", overwrite: true });
	}, []);

	// Closing beat: shrink away into the static diamond underneath (and back, should it ever un-hide).
	const wasHidden = useRef(hidden);
	useEffect(() => {
		if (!ref.current || hidden === wasHidden.current) return;
		wasHidden.current = hidden;
		const s = hidden ? 0 : 1;
		gsap.to(ref.current.scale, { x: s, y: s, z: s, duration: 0.5, ease: hidden ? "power2.in" : "back.out(2)", overwrite: true });
	}, [hidden]);

	// On this team's turn the marker breathes: the spike scales UNIFORMLY from its apex (anchored at the
	// diamond vertex), so the shape just spreads bigger on the floor without deforming, and the colour
	// softly pulses its opacity.
	useEffect(() => {
		const spike = spikeRef.current;
		if (!spike || !active) return;
		const grow = gsap.to(spike.scale, { x: 1.35, y: 1.35, duration: 1.1, delay: 0.6, ease: "sine.inOut", yoyo: true, repeat: -1 });
		const blink = gsap.to(material, { opacity: 0.55, duration: 1.1, delay: 0.6, ease: "sine.inOut", yoyo: true, repeat: -1 });
		return () => {
			grow.kill();
			blink.kill();
			gsap.to(spike.scale, { x: 1, y: 1, duration: 0.3, ease: "power2.out", overwrite: true });
			gsap.to(material, { opacity: 1, duration: 0.3, ease: "power2.out", overwrite: true });
		};
	}, [active, material]);

	// Landscape: the marker rides on the line (centred x=0), the whole group raked so it lies on the
	// floor, ref slides along x. Portrait: ref slides to the raked (y, z) of the space (so it tracks
	// the receding line), and the rake + a Z-spin (spikeSpin) turn the spike to point toward the pawn's
	// side, on the floor plane.
	const spikeAndDiamond = (
		<>
			<group ref={spikeRef} position={[0, -SPIKE_DIR[team] * DIAMOND_TIP, 0]}>
				{/* Scaled about the apex (the spikeRef origin), so it shrinks toward the diamond. */}
				<group scale={spikeScale}>
					<mesh geometry={SPIKE_GEO[team]} material={material} renderOrder={0} />
				</group>
			</group>
			{/* drawn after the spike (renderOrder 1) so the white rhombus paints over the red apex even
			    while sliding between spaces, where no static diamond is there to occlude it. */}
			<mesh geometry={DIAMOND_GEO} material={WHITE_DIAMOND_MAT} renderOrder={1} />
		</>
	);
	return (
		<group position={portrait ? [0, 0, 0] : [0, y, z]} rotation={portrait ? [0, 0, 0] : [-diamondTilt, 0, 0]}>
			<group ref={ref}>
				{portrait ? (
					<group rotation={[-diamondTilt, 0, 0]} scale={markerScale}>
						<group rotation={[0, 0, spikeSpin]}>{spikeAndDiamond}</group>
					</group>
				) : (
					<group scale={markerScale}>{spikeAndDiamond}</group>
				)}
			</group>
		</group>
	);
};

/** The battlefield line with a white diamond per space, plus a fading team-colour marker under each
 * pawn's diamond (tip on the upper vertex, opening downward), all raked onto the floor. */
export const BoardLine = ({ y = 0.5, z = 0, length = 3.0, diamondTilt = 0, redSpace = RED_START, blueSpace = BLUE_START, current = "red", redMoveDelay = 0, blueMoveDelay = 0, moveDur = 0.6, orientation = "landscape", bottomTeam = "red", markerScale = 1, spikeScale = 1, hideMarkers = false }: BoardLineProps) => {
	const spaces = Array.from({ length: BOARD_SPACES }, (_, i) => i);
	const lineRef = useRef<THREE.Mesh>(null);
	const diamonds = useRef<(THREE.Mesh | null)[]>([]);
	const portrait = orientation === "portrait";
	// Portrait: the line is vertical (length along y) and raked onto the floor plane (rotation by
	// diamondTilt around x), so it recedes in perspective. The diamonds + markers + pawns sit on that
	// same plane (`rakeLine`), so a space's diamond lines up with its pawn. Landscape keeps the
	// horizontal flat line with the diamonds raked in place.
	// markerScale (viewport-proportional, from the Battlefield) sizes the markers/diamonds/line-width the
	// same way in both orientations, so they read consistently and scale with the window.
	const lineArgs: [number, number, number] = portrait ? [0.01 * markerScale, length, 0.005] : [length, 0.01 * markerScale, 0.005];
	const diamondSize = DIAMOND * markerScale;
	const spaceCoord = (i: number): [number, number, number] => {
		if (!portrait) return [landscapeCoord(i, length), y, z];
		const { y: ry, z: rz } = rakeLine(lineCoord(i, bottomTeam, length), diamondTilt, y, z);
		return [0, ry, rz];
	};

	// Entrance: the line draws out from the centre, then the diamonds pop in from the middle outwards.
	useLayoutEffect(() => {
		const center = (BOARD_SPACES - 1) / 2;
		if (lineRef.current) {
			gsap.from(lineRef.current.scale, { [portrait ? "y" : "x"]: 0, duration: 0.55, ease: "power3.out", overwrite: true });
		}
		diamonds.current.forEach((d, i) => {
			if (!d) return;
			const fromCentre = Math.abs(i - center);
			gsap.from(d.scale, { x: 0, y: 0, z: 0, duration: 0.4, delay: 0.25 + fromCentre * 0.09, ease: "back.out(2.2)", overwrite: true });
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<group>
			{/* Portrait: the floor fills the screen and (raked toward the camera) sits in front of the
			    board's lower half, so the opaque line/diamonds get painted over. Drawing them transparent
			    with no depth-write puts them in the pass AFTER the floor, so the whole line stays visible. */}
			<mesh ref={lineRef} position={[0, y, z]} rotation={portrait ? [-diamondTilt, 0, 0] : [0, 0, 0]} renderOrder={portrait ? 1 : 0}>
				<boxGeometry args={lineArgs} />
				<meshBasicMaterial color="#ffffff" toneMapped={false} transparent={portrait} depthWrite={!portrait} />
			</mesh>
			<TeamMarker team="red" space={redSpace} y={y} z={z} length={length} diamondTilt={diamondTilt} active={current === "red"} moveDelay={redMoveDelay} moveDur={moveDur} orientation={orientation} bottomTeam={bottomTeam} markerScale={markerScale} spikeScale={spikeScale} hidden={hideMarkers} />
			<TeamMarker team="blue" space={blueSpace} y={y} z={z} length={length} diamondTilt={diamondTilt} active={current === "blue"} moveDelay={blueMoveDelay} moveDur={moveDur} orientation={orientation} bottomTeam={bottomTeam} markerScale={markerScale} spikeScale={spikeScale} hidden={hideMarkers} />
			{spaces.map((i) => (
				<mesh
					key={i}
					ref={(m) => {
						diamonds.current[i] = m;
					}}
					position={spaceCoord(i)}
					rotation={[-diamondTilt, 0, Math.PI / 4]}
					renderOrder={portrait ? 1 : 0}
				>
					<boxGeometry args={[diamondSize, diamondSize, 0.015]} />
					<meshBasicMaterial color="#ffffff" toneMapped={false} transparent={portrait} depthWrite={!portrait} />
				</mesh>
			))}
		</group>
	);
};
