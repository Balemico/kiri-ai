import * as THREE from "three";

// Soft paper-white fog band: opaque-ish cream core fading to transparent top & bottom.
// Colour lives here (the material stays white-tinted); built once at module load, same
// idiom as floorTexture.ts / cardAlpha.ts.

const buildMist = (): THREE.Texture => {
	const W = 512;
	const H = 128;
	const canvas = document.createElement("canvas");
	canvas.width = W;
	canvas.height = H;
	const ctx = canvas.getContext("2d")!;
	const g = ctx.createLinearGradient(0, 0, 0, H);
	g.addColorStop(0, "rgba(236,228,208,0)");
	g.addColorStop(0.5, "rgba(236,228,208,1)");
	g.addColorStop(1, "rgba(236,228,208,0)");
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, W, H);
	// Horizontal unevenness so the band reads as vapour, not a rule: carve soft random dips.
	ctx.globalCompositeOperation = "destination-out";
	for (let i = 0; i < 26; i++) {
		const x = (i * 97) % W; // deterministic scatter (no Math.random — stable across reloads)
		const r = 18 + ((i * 41) % 30);
		const grad = ctx.createRadialGradient(x, (i % 2) * H, 0, x, (i % 2) * H, r * 2);
		grad.addColorStop(0, "rgba(0,0,0,0.75)");
		grad.addColorStop(1, "rgba(0,0,0,0)");
		ctx.fillStyle = grad;
		ctx.fillRect(x - r * 2, 0, r * 4, H);
	}
	const tex = new THREE.CanvasTexture(canvas);
	tex.wrapS = THREE.RepeatWrapping; // the bands scroll horizontally forever
	tex.needsUpdate = true;
	return tex;
};

export const MIST_TEXTURE = buildMist();
