import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EDGE_VIGNETTE_TEXTURE } from "../../../vignetteTexture";

export interface ScreenVignetteProps {
	/** Tone of the darkening (ink black). */
	shade: string;
	/** Alpha in the corners (the edges get less, the centre none). */
	opacity: number;
	/** Draw order: above the corner team glows (60) so it darkens them too, below the landing zones (80) and cards (100+). */
	renderOrder?: number;
}

/** Distance in front of the camera the plane rides at (just in front of the corner vignettes). */
const DIST = 0.99;
/** Rate of the opacity fade-in (1/s, exponential). */
const FADE_RATE = 3.5;

/**
 * A dark vignette over the WHOLE screen: clear in the middle, deepening toward every edge and all four
 * corners. Glued to the camera like `CornerVignette` and drawn over it, so the acting team's corner glow
 * is shaded down too; the cards still paint over it.
 */
export const ScreenVignette = ({ shade, opacity, renderOrder = 65 }: ScreenVignetteProps) => {
	const group = useRef<THREE.Group>(null);
	const mesh = useRef<THREE.Mesh>(null);

	useFrame(({ camera, size }, dt) => {
		const g = group.current;
		const m = mesh.current;
		if (!g || !m) return;
		g.position.copy(camera.position);
		g.quaternion.copy(camera.quaternion);

		const fov = (camera as THREE.PerspectiveCamera).fov ?? 30;
		const halfH = DIST * Math.tan(THREE.MathUtils.degToRad(fov) / 2);
		const halfW = halfH * (size.width / size.height);
		m.scale.set(2 * halfW, 2 * halfH, 1);
		m.position.set(0, 0, -DIST);

		const mat = m.material as THREE.MeshBasicMaterial;
		mat.color.set(shade);
		const k = 1 - Math.exp(-FADE_RATE * Math.min(dt, 0.1));
		mat.opacity += (opacity - mat.opacity) * k;
	});

	return (
		<group ref={group}>
			<mesh ref={mesh} renderOrder={renderOrder} frustumCulled={false}>
				<planeGeometry args={[1, 1]} />
				<meshBasicMaterial map={EDGE_VIGNETTE_TEXTURE} color={shade} transparent opacity={0} depthTest={false} depthWrite={false} toneMapped={false} />
			</mesh>
		</group>
	);
};
