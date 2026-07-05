import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ScreenQuad } from "@react-three/drei";
import * as THREE from "three";

// Full-screen triangle (ScreenQuad) — draw straight in clip space, ignore the camera.
// ScreenQuad's geometry has NO uv attribute (only position spanning the big triangle), so we
// derive uv from the clip-space position: visible screen [-1,1] → [0,1].
const vertexShader = /* glsl */ `
	varying vec2 vUv;
	void main() {
		// Match the CSS convention (0 = top, 1 = bottom) so uBandY lines up with offsetTop.
		vUv = vec2(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5);
		gl_Position = vec4(position.xy, 0.0, 1.0);
	}
`;

// A single horizontal sumi-e stroke that paints itself on. The ink front advances along the
// stroke with a noise-perturbed, soft edge (an organic bleed, not a hard wipe), the body has
// drybrush streaks, and the shade varies "more or less black". Aspect-corrected, so no stretch.
const fragmentShader = /* glsl */ `
	precision highp float;
	varying vec2 vUv;
	uniform float uTime;
	uniform float uProgress;   // 0 = blank, 1 = fully painted
	uniform vec2 uAspect;      // aspect correction (x scaled on wide screens)
	uniform float uBandY;      // vertical centre of the stroke, in uv (0 top .. 1 bottom)
	uniform float uThickness;  // half-thickness of the stroke (uv-height units)
	uniform float uHalfLen;    // half-length as a fraction of the half-width
	uniform vec3 uColor;

	vec2 hash(vec2 p) {
		p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
		return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
	}

	float noise(vec2 p) {
		vec2 i = floor(p);
		vec2 f = fract(p);
		vec2 u = f * f * (3.0 - 2.0 * f);
		return mix(
			mix(dot(hash(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)), dot(hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
			mix(dot(hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), dot(hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
			u.y);
	}

	float fbm(vec2 p) {
		float v = 0.0;
		float a = 0.5;
		for (int i = 0; i < 5; i++) {
			v += a * noise(p);
			p *= 2.0;
			a *= 0.5;
		}
		return v;
	}

	void main() {
		vec2 p = vec2((vUv.x - 0.5) * uAspect.x, vUv.y - uBandY);
		float X = uAspect.x * uHalfLen;       // half-length of the stroke
		float t = p.x / X;                     // -1 .. 1 along the stroke

		// Slight centreline wander + sharp taper toward the lifted ends.
		float endTaper = smoothstep(1.06, 0.78, abs(t));
		float centre = (fbm(vec2(t * 2.0, 5.0)) - 0.5) * 0.03;
		float dy = p.y - centre;

		// Ragged, undulating top & bottom contours — the brushy fibre edges (NOT a soft gradient).
		float undul = fbm(vec2(t * 2.6, 9.0)) - 0.5;                          // slow thickness swell
		float ragTop = fbm(vec2(p.x * 30.0, 12.0)) - 0.5;                     // high-freq raggedness, top
		float ragBot = fbm(vec2(p.x * 30.0, 2.0)) - 0.5;                      // ...and bottom (independent)
		float rag = dy > 0.0 ? ragTop : ragBot;
		float edge = uThickness * mix(0.5, 1.0, endTaper) * (0.82 + 0.45 * undul) * (1.0 + rag * 0.75);

		// Crisp edge (thin antialias only) — the raggedness lives in the edge value, not in a blur.
		float aa = 0.004;
		float body = 1.0 - smoothstep(edge - aa, edge + aa, abs(dy));

		// Drybrush interior: horizontal dry streaks + fine bristle grain dragged over the paper.
		float streak = fbm(vec2(p.x * 7.0, p.y * 64.0));
		float fiber = fbm(vec2(p.x * 58.0, p.y * 120.0));
		float ink = mix(0.6, 1.0, smoothstep(0.32, 0.58, streak)) * mix(0.72, 1.0, smoothstep(0.34, 0.6, fiber));

		// Paint-on reveal: a noisy ink front sweeping along t, with a tight bleed edge.
		float e = uProgress * uProgress * (3.0 - 2.0 * uProgress); // ease
		float front = mix(-1.15, 1.18, e);
		float frontNoise = (fbm(vec2(p.y * 8.0, p.x * 5.0)) - 0.5) * 0.10;
		float reveal = smoothstep(front + 0.06, front - 0.04, t + frontNoise);

		float alpha = body * ink * reveal;
		if (alpha < 0.03) discard; // crisp cutoff → material edge, no haze

		float shade = mix(0.6, 1.0, fbm(vec2(p.x * 4.0, p.y * 4.0) + 2.0)); // più o meno nero
		vec3 col = mix(vec3(0.06), uColor, shade);
		gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
	}
`;

interface InkProps {
	color: string;
	/** Seconds for the stroke to paint across. */
	seconds: number;
	/** Vertical centre of the stroke, as a fraction of viewport height (0 top .. 1 bottom). */
	bandY: number;
	/** Half-thickness of the stroke, in viewport-height fractions. */
	thickness: number;
	/** Half-length of the stroke as a fraction of viewport width (aspect-independent). */
	halfLen: number;
}

const InkPlane = ({ color, seconds, bandY, thickness, halfLen }: InkProps) => {
	const { size } = useThree();
	// Uniforms are mutated each frame through this ref (not the useMemo value) — the strict
	// react-hooks immutability rule forbids mutating a hook return directly (see CLAUDE.md).
	const matRef = useRef<THREE.ShaderMaterial>(null);

	const material = useMemo(
		() =>
			new THREE.ShaderMaterial({
				transparent: true,
				depthTest: false,
				depthWrite: false,
				vertexShader,
				fragmentShader,
				uniforms: {
					uTime: { value: 0 },
					uProgress: { value: 0 },
					uAspect: { value: new THREE.Vector2(1, 1) },
					uBandY: { value: 0.5 },
					uThickness: { value: 0.12 },
					uHalfLen: { value: 0.46 },
					uColor: { value: new THREE.Color() },
				},
			}),
		[],
	);

	// material={}/object materials aren't auto-disposed by R3F (CLAUDE.md).
	useEffect(() => () => material.dispose(), [material]);

	useFrame(({ clock }) => {
		const mat = matRef.current;
		if (!mat) return;
		const t = clock.elapsedTime;
		mat.uniforms.uTime.value = t;
		mat.uniforms.uProgress.value = Math.min(t / seconds, 1);
		const aspect = size.width / Math.max(size.height, 1);
		mat.uniforms.uAspect.value.set(aspect >= 1 ? aspect : 1, aspect >= 1 ? 1 : 1 / aspect);
		mat.uniforms.uBandY.value = bandY;
		mat.uniforms.uThickness.value = thickness;
		mat.uniforms.uHalfLen.value = halfLen;
		(mat.uniforms.uColor.value as THREE.Color).set(color);
	});

	return (
		<ScreenQuad>
			<primitive ref={matRef} object={material} attach="material" />
		</ScreenQuad>
	);
};

/** Full-screen canvas of a single sumi-e stroke that paints itself on, behind the title. */
export const InkBrush = ({ color, seconds, bandY, thickness, halfLen }: InkProps) => (
	<Canvas
		style={{ position: "fixed", inset: 0, pointerEvents: "none" }}
		gl={{ alpha: true, antialias: true }}
		dpr={[1, 2]}
		frameloop="always"
	>
		<InkPlane color={color} seconds={seconds} bandY={bandY} thickness={thickness} halfLen={halfLen} />
	</Canvas>
);
