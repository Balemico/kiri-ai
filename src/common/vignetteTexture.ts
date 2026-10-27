import * as THREE from "three";

// White corner falloff (alpha only) for the HUD corner vignette (atoms/CornerVignette): a radial
// gradient anchored at the top-left corner, eased with many stops (smoothstep) so it melts into the
// scene with no visible rim or banding. The mesh tints it, so one texture serves black and every team
// colour, and stretches it into an ellipse. Built once at module load (same idiom as mistTexture.ts).

const buildVignette = (): THREE.Texture => {
	const SIZE = 512;
	const STOPS = 16;
	const canvas = document.createElement("canvas");
	canvas.width = SIZE;
	canvas.height = SIZE;
	const ctx = canvas.getContext("2d")!;
	const g = ctx.createRadialGradient(0, 0, 0, 0, 0, SIZE);
	for (let i = 0; i <= STOPS; i++) {
		const t = i / STOPS;
		const a = 1 - t * t * (3 - 2 * t); // smoothstep falloff: full at the corner, 0 at the radius
		g.addColorStop(t, `rgba(255,255,255,${a.toFixed(3)})`);
	}
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, SIZE, SIZE);
	const tex = new THREE.CanvasTexture(canvas);
	tex.needsUpdate = true;
	return tex;
};

/** The corner falloff, anchored top-left (mirror the mesh for the right corner). */
export const VIGNETTE_TEXTURE = buildVignette();
