import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

export interface ParallaxLayerProps {
	url: string;
	/** 0 = far/still, 1 = near/moves most. Scales both pointer-parallax and idle drift. */
	depth: number;
	/** Phase offset so layers don't drift in lockstep. */
	phase: number;
	z: number;
	renderOrder: number;
	width: number;
	height: number;
	centerY: number;
	/** Horizontal anchor of the panel (world). The parallax/drift oscillates AROUND it. */
	centerX?: number;
	parallaxX: number;
	parallaxY: number;
	driftAmp: number;
	driftSpeed: number;
	/** Easing toward the target position (0–1 per frame). */
	lerp?: number;
	/** Fired once when the material exists — lets a parent drive opacity (intro paint-on). */
	onMaterial?: (mat: THREE.MeshBasicMaterial) => void;
	/** Optional alpha map (multiplies the PNG's own alpha) — e.g. a soft fade on the bottom edge. */
	alphaMap?: THREE.Texture;
}

/** One full-frame painting layer that eases toward a pointer- + drift-driven offset. */
export const ParallaxLayer = ({ url, depth, phase, z, renderOrder, width, height, centerY, centerX = 0, parallaxX, parallaxY, driftAmp, driftSpeed, lerp = 0.06, onMaterial, alphaMap }: ParallaxLayerProps) => {
	const ref = useRef<THREE.Mesh>(null);
	const notified = useRef(false);
	// Configure colour space in the load callback (outside render) so the painted colours stay true.
	const texture = useTexture(url, (loaded) => {
		const tex = Array.isArray(loaded) ? loaded[0] : loaded;
		tex.colorSpace = THREE.SRGBColorSpace;
	});

	const materialRef = (mat: THREE.MeshBasicMaterial | null) => {
		if (mat && !notified.current) {
			notified.current = true;
			onMaterial?.(mat);
		}
	};

	useFrame((state) => {
		const mesh = ref.current;
		if (!mesh) return;
		const t = state.clock.elapsedTime;
		const drift = Math.sin(t * driftSpeed + phase) * driftAmp * depth;
		const targetX = centerX + state.pointer.x * parallaxX * depth + drift;
		const targetY = centerY + state.pointer.y * parallaxY * depth;
		mesh.position.x += (targetX - mesh.position.x) * lerp;
		mesh.position.y += (targetY - mesh.position.y) * lerp;
	});

	return (
		<mesh ref={ref} position={[centerX, centerY, z]} renderOrder={renderOrder}>
			<planeGeometry args={[width, height]} />
			<meshBasicMaterial ref={materialRef} map={texture} alphaMap={alphaMap} transparent toneMapped={false} depthWrite={false} />
		</mesh>
	);
};
