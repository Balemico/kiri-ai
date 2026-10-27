import { useEffect, useMemo, useRef } from "react";
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

	// One clone per band for the component's LIFETIME: the offsets scroll independently, so each
	// band needs its own texture instance, but a clone per render would leak GPU textures (R3F
	// auto-disposes only the JSX-declared material, not textures passed via the map prop).
	const textures = useMemo(() => Array.from({ length: bands }, () => MIST_TEXTURE.clone()), [bands]);
	useEffect(() => () => textures.forEach((t) => t.dispose()), [textures]);

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
					{/* Per-band renderOrder keeps overlapping translucent bands stable (still well behind the floor at −10). */}
					<planeGeometry args={[width, height]} />
					<meshBasicMaterial map={textures[i]} transparent opacity={opacity * (1 - i * 0.2)} toneMapped={false} depthWrite={false} />
				</mesh>
			))}
		</group>
	);
};
