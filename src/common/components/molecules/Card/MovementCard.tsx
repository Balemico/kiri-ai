import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { gsap } from "gsap";
import { CardModel } from "../../atoms";
import { useCardTextures } from "../../../hooks/useCardTextures";
import { useCardFlip } from "../../../hooks/useCardFlip";
import { CARD_ALPHA_MAP } from "../../../cardAlpha";
import type { CardDragHandlers } from "../HandCard";
import type { CardView } from "../../../state";
import type { Side } from "../../../game";

export interface MovementCardProps {
	view: CardView;
	/** Whether this card is the currently hovered one — only then does the side dimming show. */
	active?: boolean;
	/** Touch device: the side preview comes from the tap, not from hover-over. */
	coarse?: boolean;
	/** Touch drag wiring. When present, each half starts a drag (via `onSideDown`) and the plain-tap /
	 *  drag resolution is owned by Hand; a tap on the lifted card still plays the tapped half. */
	drag?: CardDragHandlers;
	/** In-hand: choose a face (top/bottom) and play it. */
	onSelectSide?: (side: Side) => void;
	/** Placed: click to return to hand. */
	onUnplace?: () => void;
}

// Invisible pick volumes for the two halves (raycasting hits geometry whatever the material opacity).
const HIT_MATERIAL = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

/** The dim for ONE half: a black overlay whose alpha mask is that half of the card's rounded-rect
 *  mask (rounded outer corners, straight seam). */
const newOverlayMaterial = (half: Side) => {
	const alphaMap = CARD_ALPHA_MAP.clone();
	alphaMap.repeat.set(1, 0.5);
	// The plane's v = 1 edge is the half's OUTER edge for "top" (toward −Z), the seam for "bottom".
	alphaMap.offset.set(0, half === "top" ? 0.5 : 0);
	alphaMap.needsUpdate = true;
	return new THREE.MeshBasicMaterial({
		color: 0x000000,
		transparent: true,
		opacity: 0,
		alphaMap,
		depthWrite: false,
		depthTest: false, // same as the card faces — overlays sit on top regardless of z
		toneMapped: false,
	});
};

/** A movement card with two selectable faces (top / bottom). */
export const MovementCard = ({ view, active, coarse, drag, onSelectSide, onUnplace }: MovementCardProps) => {
	const { nodes } = useGLTF("/models/card.glb");
	const { frontMaterial, backMaterial } = useCardTextures(view.team, view.cardId);
	const flipRef = useCardFlip(view.faceUp);

	const [hoveredSide, setHoveredSide] = useState<Side | null>(null);
	// Stable per-card overlay materials (useMemo keeps them readable during render).
	const topMat = useMemo(() => newOverlayMaterial("top"), []);
	const bottomMat = useMemo(() => newOverlayMaterial("bottom"), []);

	// Free the per-card overlay materials (and their cloned masks) on unmount.
	useEffect(() => () => {
		[topMat, bottomMat].forEach((m) => {
			m.alphaMap?.dispose();
			m.dispose();
		});
	}, [topMat, bottomMat]);

	const inHand = view.location === "hand";
	const selectedSide = view.location === "slot" ? view.side : null;
	// Side dimming shows only on the hovered card (active) — never on a card the pointer isn't on.
	const effectiveHover = inHand && view.interactive && active ? hoveredSide : null;

	// Dim the face that is NOT hovered/selected.
	useEffect(() => {
		const dimTop = effectiveHover === "bottom" || selectedSide === "bottom";
		const dimBottom = effectiveHover === "top" || selectedSide === "top";
		gsap.to(topMat, { opacity: dimTop ? 0.4 : 0, duration: 0.3, ease: "power2.out" });
		gsap.to(bottomMat, { opacity: dimBottom ? 0.4 : 0, duration: 0.3, ease: "power2.out" });
	}, [effectiveHover, selectedSide, topMat, bottomMat]);

	const { quarterHeight, cardWidth, faceY } = useMemo(() => {
		const g = (nodes.Cube_1 as THREE.Mesh).geometry;
		g.computeBoundingBox();
		const bb = g.boundingBox;
		const height = bb ? bb.max.z - bb.min.z : 0.14; // local Z = the card's long (top↔bottom) axis
		const width = bb ? bb.max.x - bb.min.x : 0.1; // local X = the card's width
		return { quarterHeight: height / 4, cardWidth: width, faceY: bb ? bb.max.y : 0 }; // local +Y = the face's normal
	}, [nodes]);
	// Touch only: a hairline across the seam advertises that the lifted card is split into two pickable
	// faces (there's no hover to reveal that). Shown only while the card is lifted and interactive.
	const showSeam = !!coarse && active && inHand && view.interactive;

	const geom = (nodes.Cube_1 as THREE.Mesh).geometry;

	const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
	// Each half = an invisible pick volume (the card body, halved) + a FLAT dim plane lying on the face.
	// The dim used to be the halved card BOX itself: with depth testing off, its sides and underside
	// drew too, so on a tilted card the shadow spilled off the card onto whatever lay beside it.
	const dimPlane = (zOffset: number, material: THREE.Material) => (
		<mesh position={[0, faceY + 0.0005, zOffset]} rotation={[-Math.PI / 2, 0, 0]} material={material} userData={{ orderBump: 0.5 }} raycast={() => null}>
			<planeGeometry args={[cardWidth, quarterHeight * 2]} />
		</mesh>
	);
	const section = (side: Side, zOffset: number) => {
		const common = { position: [0, 0.00001, zOffset] as [number, number, number], scale: [1, 1, 0.5] as [number, number, number], geometry: geom, material: HIT_MATERIAL };
		// Touch (portrait drag): each half starts the shared drag from its side. A plain tap on a lifted card
		// plays that half; a drag out is resolved by Hand (movement cards return to the hand lifted, not
		// auto-placed). Press feedback dims the other half once the card is lifted.
		if (drag) {
			return (
				<mesh
					{...common}
					onPointerDown={(e) => {
						if (active && inHand && view.interactive) setHoveredSide(side);
						drag.onSideDown?.(side, e);
					}}
					onPointerMove={drag.onPointerMove}
					onPointerUp={drag.onPointerUp}
					onPointerCancel={drag.onPointerUp}
				/>
			);
		}
		return (
			<mesh
				{...common}
				onPointerOver={() => {
					// Hover (desktop) previews which face is selected by dimming the other. No stopPropagation:
					// the stationary hover zone behind drives the lift. Touch (no drag = landscape) skips it.
					if (coarse) return;
					if (inHand && view.interactive) setHoveredSide(side);
				}}
				onPointerDown={() => {
					// Touch press feedback (once lifted): pressing a half lights it up by dimming the other.
					if (coarse && active && inHand && view.interactive) setHoveredSide(side);
				}}
				onPointerOut={() => {
					if (inHand && view.interactive) setHoveredSide(null);
				}}
				onClick={(e) => {
					stop(e);
					if (!view.interactive) return;
					if (inHand) {
						// Tap a half to pick that face. The first tap on a not-yet-lifted card only arms it (in
						// Hand); the second, on the lifted card, plays the tapped face. Clear the local preselect —
						// the component stays mounted across slot↔hand, so a stale side would show on a re-lift.
						setHoveredSide(null);
						onSelectSide?.(side);
					} else {
						onUnplace?.();
					}
				}}
			/>
		);
	};

	return (
		<CardModel ref={flipRef} frontMaterial={frontMaterial} backMaterial={backMaterial}>
			{/* -Z is "up" on screen after the card's base rotation. */}
			{section("top", -quarterHeight)}
			{section("bottom", quarterHeight)}
			{dimPlane(-quarterHeight, topMat)}
			{dimPlane(quarterHeight, bottomMat)}
			{/* Touch affordance: a hairline along the seam (local Z=0) so the lifted card visibly reads as
			    two pickable halves. Sits a hair above the face; depthTest off + last child = always on top. */}
			{showSeam && (
				<mesh position={[0, 0.01, 0]}>
					<boxGeometry args={[cardWidth * 0.84, 0.004, quarterHeight * 0.07]} />
					<meshBasicMaterial color={0x1a1614} transparent opacity={0.5} depthTest={false} depthWrite={false} toneMapped={false} />
				</mesh>
			)}
		</CardModel>
	);
};
