import * as THREE from "three";

// Vertical alpha gradients for the duel ground and the scenery panels. Colour comes from the
// shared washi-paper plate (0-base); these only supply the alpha. Built once at module load
// (same idiom as cardAlpha.ts).

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/**
 * A 16×512 alpha ramp, transparent at canvas row `from` and opaque at `to` (fractions of the
 * height, 0 = top of the plane), eased with a smoothstep so the ramp has no visible kink at
 * either end — a linear ramp reads as a hard line where it meets the flat part.
 */
const buildFade = (from: number, to: number): THREE.Texture => {
	const W = 16;
	const H = 512;
	const canvas = document.createElement("canvas");
	canvas.width = W;
	canvas.height = H;
	const ctx = canvas.getContext("2d")!;
	const g = ctx.createLinearGradient(0, 0, 0, H);
	const STEPS = 16;
	for (let i = 0; i <= STEPS; i++) {
		const t = i / STEPS;
		const v = Math.round(smoothstep(t) * 255);
		g.addColorStop(from + (to - from) * t, `rgb(${v},${v},${v})`);
	}
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, W, H);

	const tex = new THREE.CanvasTexture(canvas);
	tex.needsUpdate = true;
	return tex;
};

// The floor's far edge (top of the plane = the horizon) fades to transparent so the tilted ground
// melts into the background; the near edge is opaque.
export const FLOOR_ALPHA = buildFade(0, 0.5);

// The scenery panels' BOTTOM edge melts away (ramp inverted: opaque at the top). On narrower
// landscape windows the painting is short enough that the paper plate's bottom edge lands above the
// floor's opaque band — without this it reads as a hard cut against the cream clear colour.
export const STAGE_BOTTOM_ALPHA = (() => {
	const tex = buildFade(0, 0.24);
	tex.flipY = false; // canvas row 0 → plane BOTTOM (uv.y = 0), so the transparent end sits at the base
	return tex;
})();
