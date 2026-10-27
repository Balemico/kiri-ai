import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { VIGNETTE_TEXTURE } from "../../../vignetteTexture";

export interface CornerVignetteProps {
	/** Which top corner it sits in. */
	corner: "left" | "right";
	/** Resting tone (ink black). */
	shade: string;
	/** Alpha of the resting tone. */
	shadeOpacity: number;
	/** Tone it glows in while lit (the team colour of this corner). */
	glow: string;
	/** Lit = glowing in `glow`; otherwise it rests in `shade`. */
	lit: boolean;
	/** Alpha of the glow. */
	glowOpacity: number;
	/** Extent across / down, as fractions of the visible screen. */
	width: number;
	height: number;
	/** Seconds for one slow breath of the vignette. */
	drift: number;
	/** Seconds after mount before it starts fading in (lands with the DOM HUD). */
	delay?: number;
	/** Draw order: above scenery/floor, below the landing zones (80) and cards (100+). */
	renderOrder?: number;
}

/** Distance in front of the camera the vignette plane rides at (well past the near plane). */
const DIST = 1;
/** Rate of the colour / opacity cross-fade (1/s, exponential). */
const FADE_RATE = 3.5;
const tmpColor = new THREE.Color();

/**
 * A soft gradual glow in a top corner of the SCREEN, living inside the 3D scene so the cards
 * paint over it while the backdrop stays under it. The plane is glued to the camera every frame (so it
 * holds the corner through the intro approach and any resize), ignores depth, and breathes slowly
 * around its anchored corner. Lit/unlit cross-fades the tint + alpha in place — same shape throughout.
 */
export const CornerVignette = ({ corner, shade, shadeOpacity, glow, lit, glowOpacity, width, height, drift, delay = 1.4, renderOrder = 60 }: CornerVignetteProps) => {
	const group = useRef<THREE.Group>(null);
	const mesh = useRef<THREE.Mesh>(null);
	const born = useRef<number | null>(null);

	useFrame(({ camera, size, clock }, dt) => {
		const g = group.current;
		const m = mesh.current;
		if (!g || !m) return;
		g.position.copy(camera.position);
		g.quaternion.copy(camera.quaternion);

		const fov = (camera as THREE.PerspectiveCamera).fov ?? 30;
		const halfH = DIST * Math.tan(THREE.MathUtils.degToRad(fov) / 2);
		const halfW = halfH * (size.width / size.height);
		const w = width * 2 * halfW;
		const h = height * 2 * halfH;
		// Slow breath around the anchored corner: an uneven swell, never lifting off the edges.
		const t = (clock.elapsedTime * Math.PI * 2) / drift;
		const s = 1 + 0.035 * (1 - Math.cos(t)) + 0.012 * Math.sin(t * 1.7);
		const dir = corner === "left" ? 1 : -1;
		m.scale.set(w * s * dir, h * s, 1);
		// Anchored exactly on the screen corner — any sideways wander would bare a strip along the edge.
		m.position.set(dir * (-halfW + (w * s) / 2), halfH - (h * s) / 2, -DIST);

		born.current ??= clock.elapsedTime;
		const started = clock.elapsedTime - born.current >= delay;
		const mat = m.material as THREE.MeshBasicMaterial;
		const k = 1 - Math.exp(-FADE_RATE * Math.min(dt, 0.1));
		mat.color.lerp(tmpColor.set(lit ? glow : shade), k);
		mat.opacity += ((started ? (lit ? glowOpacity : shadeOpacity) : 0) - mat.opacity) * k;
	});

	return (
		<group ref={group}>
			<mesh ref={mesh} renderOrder={renderOrder} frustumCulled={false}>
				<planeGeometry args={[1, 1]} />
				<meshBasicMaterial map={VIGNETTE_TEXTURE} color={shade} transparent opacity={0} depthTest={false} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
			</mesh>
		</group>
	);
};
