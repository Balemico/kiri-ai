import { forwardRef, type ReactNode } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";

export interface CardModelProps {
	position?: [number, number, number];
	rotation?: [number, number, number];
	scale?: number | [number, number, number];
	frontMaterial: THREE.Material;
	backMaterial: THREE.Material;
	renderOrder?: number;
	/** Interactive overlays / hit meshes placed inside the flip group. */
	children?: ReactNode;
}

// Floor for a card face's draw order: high enough to clear the scenery, floor and pawns even before
// HandCard's effect refines it per-card for inter-card stacking (which only adds to this base).
const CARD_RENDER_BASE = 100;

/**
 * The shared 3D card body (GLB faces + front/back materials).
 * The forwarded ref points at the inner flip group so callers can animate it.
 */
export const CardModel = forwardRef<THREE.Group, CardModelProps>(
	({ position, rotation, scale, frontMaterial, backMaterial, renderOrder = CARD_RENDER_BASE, children }, flipRef) => {
		const { nodes } = useGLTF("/models/card.glb");
		const geom = (name: string) => (nodes[name] as THREE.Mesh).geometry;
		return (
			<group position={position} rotation={rotation ?? [Math.PI / 2, 0, 0]} scale={scale ?? 7}>
				<group ref={flipRef}>
					<mesh castShadow receiveShadow geometry={geom("Cube_1")} material={frontMaterial} renderOrder={renderOrder} />
					<mesh castShadow receiveShadow geometry={geom("Cube_2")} material={backMaterial} renderOrder={renderOrder} />
					<mesh castShadow receiveShadow geometry={geom("Cube_3")} material={frontMaterial} renderOrder={renderOrder} />
					{children}
				</group>
			</group>
		);
	}
);

CardModel.displayName = "CardModel";

useGLTF.preload("/models/card.glb");
