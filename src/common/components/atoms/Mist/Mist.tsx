import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MIST_TEXTURE } from "../../../mistTexture";

export interface MistProps {
	bands: number;
	opacity: number;
	/** Horizontal drift in world units/s (each band alternates direction). */
	speed: number;
	/** World height of one band. */
	height: number;
	/** World-Y centre of the band cluster. */
	y: number;
	width: number;
	z?: number;
}

/** Slow-drifting paper-white fog bands over the horizon — the lobby's sense of waiting. */
export const Mist = ({ bands, opacity, speed, height, y, width, z = -0.05 }: MistProps) => {
	const group = useRef<THREE.Group>(null);

	// Scroll the texture offset (not the meshes): seamless wrap, zero re-layout.
	useFrame((state) => {
		const g = group.current;
		if (!g) return;
		g.children.forEach((mesh, i) => {
			const mat = (mesh as THREE.Mesh).material as THREE.MeshBasicMaterial;
			if (mat.map) mat.map.offset.x = state.clock.elapsedTime * speed * (i % 2 === 0 ? 1 : -0.7) * (1 + i * 0.35);
		});
	});

	return (
		<group ref={group}>
			{Array.from({ length: bands }, (_, i) => (
				<mesh key={i} position={[0, y + (i - (bands - 1) / 2) * height * 0.55, z]} renderOrder={-50 + i}>
					<planeGeometry args={[width, height]} />
					{/* Each band CLONES the texture so the offsets scroll independently. */}
					<meshBasicMaterial map={MIST_TEXTURE.clone()} transparent opacity={opacity * (1 - i * 0.2)} toneMapped={false} depthWrite={false} />
				</mesh>
			))}
		</group>
	);
};
