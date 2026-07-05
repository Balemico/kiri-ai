import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { Card } from "../Card";
import { TOUCH_HINT, type CardTransform, type CardEntry } from "../../../layout";
import type { CardView } from "../../../state";
import type { Side } from "../../../game";

// One shared invisible material for the hover hit area (no per-card allocation).
const HOVER_HIT_MATERIAL = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

/** Touch drag wiring for a card's hit mesh (pointer-capture based; provided by Hand on coarse). */
export interface CardDragHandlers {
	onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
	onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
	onPointerUp: (e: ThreeEvent<PointerEvent>) => void;
	/** Movement cards start the drag from a specific half — the side that a plain tap will play. */
	onSideDown?: (side: Side, e: ThreeEvent<PointerEvent>) => void;
}

export interface HandCardProps {
	view: CardView;
	target: CardTransform;
	/** When present, the card animates in from below the viewport (cascade). */
	entry?: CardEntry;
	/** When present, the card mounts at `from` and slides down to `target` (leaving the hand). */
	exit?: { from: CardTransform };
	onHover?: () => void;
	onHoverEnd?: () => void;
	onPlace?: (side: Side | null) => void;
	onUnplace?: () => void;
	/** Resting transform for the stationary hover hit zone (fan cards only). */
	hitAnchor?: CardTransform;
	/** Hover hit-zone geometry (local to hitAnchor): width, height, vertical centre. */
	hit?: { w: number; h: number; y: number };
	/** Whether this card is the currently hovered one (drives movement-card side dimming). */
	active?: boolean;
	/** Touch device: drop the hover hit zone (the lift/confirm is driven by taps in Hand, not hover). */
	coarse?: boolean;
	/** Touch drag handlers for this card's hit mesh (single cards only; movement cards stay on tap). */
	drag?: CardDragHandlers;
	/** Draw-order offset on top of the z-derived order — lets a card layer independent of its z. */
	renderBias?: number;
}

/** Positions a single card (fan / slot / set-aside) and tweens it to its target. */
export const HandCard = ({ view, target, entry, exit, onHover, onHoverEnd, onPlace, onUnplace, hitAnchor, hit, active, coarse, drag, renderBias = 0 }: HandCardProps) => {
	const ref = useRef<THREE.Group>(null);
	const pulseRef = useRef<THREE.Group>(null);
	const mounted = useRef(false);
	// Entry / exit only matter on first mount; capture them so they aren't effect dependencies.
	const entryRef = useRef(entry);
	const exitRef = useRef(exit);
	const [x, y, z] = target.position;

	const rotX = target.rotationX ?? 0;

	useLayoutEffect(() => {
		const g = ref.current;
		if (!g) return;

		if (!mounted.current) {
			mounted.current = true;
			const leaving = exitRef.current;
			const initial = entryRef.current;
			if (leaving) {
				// Mount at the card's last fan transform, then slide down/out to the target.
				const f = leaving.from;
				g.position.set(f.position[0], f.position[1], f.position[2]);
				g.rotation.set(f.rotationX ?? 0, 0, f.rotationZ);
				g.scale.setScalar(f.scale);
				gsap.to(g.position, { x, y, z, duration: 0.5, ease: "power2.in", overwrite: true });
				gsap.to(g.rotation, { x: rotX, z: target.rotationZ, duration: 0.5, ease: "power2.in", overwrite: true });
				gsap.to(g.scale, { x: target.scale, y: target.scale, z: target.scale, duration: 0.5, ease: "power2.in", overwrite: true });
			} else if (initial) {
				// Start off-screen below, slightly tilted and shrunk, then rise and settle.
				g.position.set(x, initial.fromY, z);
				g.rotation.set(rotX, 0, target.rotationZ * 0.5);
				g.scale.setScalar(target.scale * 0.85);
				gsap.to(g.position, { x, y, z, duration: 0.7, delay: initial.delay, ease: "back.out(1.05)", overwrite: true });
				gsap.to(g.rotation, { x: rotX, z: target.rotationZ, duration: 0.75, delay: initial.delay, ease: "power3.out", overwrite: true });
				gsap.to(g.scale, {
					x: target.scale,
					y: target.scale,
					z: target.scale,
					duration: 0.6,
					delay: initial.delay,
					ease: "power2.out",
					overwrite: true,
				});
			} else {
				g.position.set(x, y, z);
				g.rotation.set(rotX, 0, target.rotationZ);
				g.scale.setScalar(target.scale);
			}
			return;
		}

		gsap.to(g.position, { x, y, z, duration: 0.5, ease: "power2.out", overwrite: true });
		gsap.to(g.rotation, { x: rotX, z: target.rotationZ, duration: 0.5, ease: "power2.out", overwrite: true });
		gsap.to(g.scale, { x: target.scale, y: target.scale, z: target.scale, duration: 0.3, ease: "power2.out", overwrite: true });
	}, [x, y, z, target.rotationZ, target.scale, rotX]);

	// Cards are the topmost UI: they must sit above the scenery AND the floor, even when the
	// floor is pushed in front of them in z. Make every card mesh ignore depth and draw last,
	// with a per-card order from its stacking z so the fan still overlaps in the right order.
	// `renderBias` then lets a card layer independent of its z (e.g. set-aside sits behind the
	// committed cards even though its z is larger).
	useLayoutEffect(() => {
		const g = ref.current;
		if (!g) return;
		const order = 100 + Math.round(z * 100) + renderBias;
		g.traverse((o) => {
			const mesh = o as THREE.Mesh;
			if (!mesh.isMesh) return;
			mesh.renderOrder = order;
			const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
			for (const m of mats) {
				if (!m || !(m instanceof THREE.Material)) continue;
				m.depthTest = false;
				m.transparent = true;
				m.needsUpdate = true;
			}
		});
	}, [z, view.key, renderBias]);

	// Touch: a lifted (armed) card breathes to advertise the confirming second tap. The pulse rides on a
	// nested group so it multiplies the card's own transform without fighting the position/scale tweens.
	useLayoutEffect(() => {
		const g = pulseRef.current;
		if (!g) return;
		if (coarse && active) {
			gsap.to(g.scale, {
				x: TOUCH_HINT.pulseScale,
				y: TOUCH_HINT.pulseScale,
				z: TOUCH_HINT.pulseScale,
				duration: TOUCH_HINT.pulseSeconds,
				ease: "sine.inOut",
				yoyo: true,
				repeat: -1,
				overwrite: true,
			});
			return () => {
				gsap.killTweensOf(g.scale);
				g.scale.setScalar(1);
			};
		}
		gsap.killTweensOf(g.scale);
		g.scale.setScalar(1);
	}, [coarse, active]);

	return (
		<>
			<group ref={ref}>
				{/* The card meshes handle clicks (and movement-card side dimming) only — hover/lift is
				    driven solely by the stationary plane below, so the lift never moves the hover target. */}
				<group ref={pulseRef}>
					<Card view={view} active={active} coarse={coarse} drag={drag} onPlace={onPlace} onUnplace={onUnplace} />
				</group>
			</group>
			{/* Stationary hover zone at the card's RESTING transform (it does NOT lift with the card). Its
			    shape IS the hit region, sized by Hand: the exact footprint when idle (precise engage, no
			    neighbour stealing), or a larger zone covering the lifted+scaled card and the column below
			    once hovered. stopPropagation on enter lets the front-most card win an overlap. Behind the
			    faces (−z) so clicks still reach the card's own sections; hover only. On touch (`coarse`)
			    there is no hover: the zone carries no handlers so a tap can't pre-lift the card before its
			    own tap-to-arm runs in Hand. */}
			{hitAnchor && hit && !coarse && (
				<group position={hitAnchor.position} rotation={[hitAnchor.rotationX ?? 0, 0, hitAnchor.rotationZ]} scale={hitAnchor.scale}>
					<mesh
						position={[0, hit.y, -0.1]}
						material={HOVER_HIT_MATERIAL}
						// onPointerMove (not just enter) + stopPropagation: every frame only the nearest
						// (front-most) zone under the pointer runs, so the hovered card is always exactly the
						// one the pointer is over — no stale/extra card stays or activates.
						onPointerMove={(e) => {
							e.stopPropagation();
							onHover?.();
						}}
						onPointerOver={(e) => {
							e.stopPropagation();
							onHover?.();
						}}
						onPointerOut={() => onHoverEnd?.()}
					>
						<planeGeometry args={[hit.w, hit.h]} />
					</mesh>
				</group>
			)}
		</>
	);
};
