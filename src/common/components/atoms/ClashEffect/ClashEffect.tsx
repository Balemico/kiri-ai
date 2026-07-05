import { useEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";
import * as THREE from "three";
import { SLASH, CLASH, PAWN } from "../../../layout";
import type { SlashControls } from "../../../hooks/useSlashControls";
import type { ClashControls } from "../../../hooks/useClashControls";

export interface ClashEffectProps {
	/** World position of the X's crossing point (midpoint between the pawns, raised by `yLift`). */
	x: number;
	y: number;
	z: number;
	/** Pawn height — sizes the blades to match the per-pawn sword-cut. */
	height: number;
	/** Seconds to wait before the blades meet (kept in sync with the attack beat). */
	delay?: number;
	/** Blade look — same yellow sword-cut as the strikes; defaults to the SLASH layout constant. */
	look?: SlashControls;
	/** Parry placement (the "Clash" Leva folder); defaults to the CLASH layout constant. */
	place?: ClashControls;
}

/** A wedge along +Y: point at the top, faded base at the bottom, centred on the origin (so two of
 *  them, rotated ±tilt, cross at the origin to form an X with the points up). */
const makeWedge = (length: number, width: number, baseAlpha: number): THREE.BufferGeometry => {
	const g = new THREE.BufferGeometry();
	// prettier-ignore
	g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
		0, length / 2, 0,            // tip — up
		-width / 2, -length / 2, 0,  // base left — down
		width / 2, -length / 2, 0,   // base right — down
	]), 3));
	// prettier-ignore
	g.setAttribute("color", new THREE.BufferAttribute(new Float32Array([
		1, 1, 1, 1,          // tip — opaque
		1, 1, 1, baseAlpha,  // base — faded
		1, 1, 1, baseAlpha,
	]), 4));
	return g;
};

/**
 * The parry: two YELLOW sword-cut blades (identical to the strikes) that cross to form an X, meeting
 * up high above the duellists' midpoint. The pair is "born" growing from the crossing point outward,
 * flashes in, holds, then fades. Played once on mount (the Battlefield remounts it via a per-action
 * key so it replays on each new clash).
 */
export const ClashEffect = ({ x, y, z, height, delay = 0, look = SLASH, place = CLASH }: ClashEffectProps) => {
	const grow = useRef<THREE.Group>(null); // single pivot at the crossing — both blades grow from it

	const length = height * look.lengthScale * place.sizeScale;
	const width = height * look.widthScale * place.sizeScale;
	const geometry = useMemo(() => makeWedge(length, width, 1 - look.baseFade), [length, width, look.baseFade]);
	useEffect(() => () => geometry.dispose(), [geometry]);

	// One shared yellow material (vertexColors carries the tip→base fade; colour tints it).
	const material = useMemo(
		() => new THREE.MeshBasicMaterial({ color: look.color, vertexColors: true, transparent: true, opacity: 0, toneMapped: false, depthTest: false, depthWrite: false, side: THREE.DoubleSide }),
		[look.color],
	);
	useEffect(() => () => material.dispose(), [material]);

	useEffect(() => {
		const g = grow.current;
		if (!g) return;
		const outStart = look.growDur + place.hold;
		const tl = gsap
			.timeline({ delay })
			.set(g.scale, { x: 0, y: 0, z: 1 }, 0)
			.set(material, { opacity: 0 }, 0)
			.to(g.scale, { x: 1, y: 1, duration: look.growDur, ease: "back.out(1.6)" }, 0)
			.to(material, { opacity: look.opacity, duration: look.inDur, ease: "power2.out" }, 0)
			.to(material, { opacity: 0, duration: look.outDur, ease: "power2.in" }, outStart);
		return () => {
			tl.kill();
		};
		// Mount-only: refs/material are stable and the cfg is captured at mount (a new clash remounts).
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Two blades rotated ±tilt about the crossing point: one leans up-right, the other up-left → an X
	// with both points up. Scaling `grow` from the origin makes the X erupt from the meeting point.
	return (
		<group position={[x, y + place.yLift, z]}>
			<group ref={grow}>
				<group rotation={[0, 0, -place.tilt]}>
					<mesh geometry={geometry} material={material} renderOrder={PAWN.renderOrder + 55} />
				</group>
				<group rotation={[0, 0, place.tilt]}>
					<mesh geometry={geometry} material={material} renderOrder={PAWN.renderOrder + 55} />
				</group>
			</group>
		</group>
	);
};
