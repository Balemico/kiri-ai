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

// Full-screen edge darkening (atoms/ScreenVignette): clear in the middle, deepening toward every edge and
// strongest in all four corners. Distance is measured in the stretched plane's own uv (so it follows
// the screen's aspect) and normalised so a corner = 1; the falloff starts at `INNER`.
const buildEdgeVignette = (): THREE.Texture => {
	const SIZE = 256;
	const INNER = 0.4;
	const canvas = document.createElement("canvas");
	canvas.width = SIZE;
	canvas.height = SIZE;
	const ctx = canvas.getContext("2d")!;
	const img = ctx.createImageData(SIZE, SIZE);
	for (let y = 0; y < SIZE; y++) {
		for (let x = 0; x < SIZE; x++) {
			const u = ((x + 0.5) / SIZE) * 2 - 1;
			const v = ((y + 0.5) / SIZE) * 2 - 1;
			const r = Math.hypot(u, v) / Math.SQRT2;
			const t = THREE.MathUtils.clamp((r - INNER) / (1 - INNER), 0, 1);
			const i = (y * SIZE + x) * 4;
			img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
			img.data[i + 3] = Math.round(255 * t * t * (3 - 2 * t));
		}
	}
	ctx.putImageData(img, 0, 0);
	const tex = new THREE.CanvasTexture(canvas);
	tex.needsUpdate = true;
	return tex;
};

/** Edge darkening over the whole screen: alpha 0 in the centre, 1 in the corners. */
export const EDGE_VIGNETTE_TEXTURE = buildEdgeVignette();
