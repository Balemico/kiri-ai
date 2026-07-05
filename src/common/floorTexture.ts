import * as THREE from "three";

// Alpha gradient for the duel floor. The floor's colour comes from the shared washi-paper
// plate (0-base); this only supplies the alpha: the far edge (top of the plane = the horizon)
// fades to transparent so the tilted ground melts into the background, the near edge is opaque.
// Built once at module load (same idiom as cardAlpha.ts).

const buildFloorAlpha = (): THREE.Texture => {
	const W = 16;
	const H = 512;
	const canvas = document.createElement("canvas");
	canvas.width = W;
	canvas.height = H;
	const ctx = canvas.getContext("2d")!;
	const g = ctx.createLinearGradient(0, 0, 0, H);
	g.addColorStop(0, "#000000"); // plane top (far / horizon) -> transparent
	g.addColorStop(0.42, "#ffffff"); // -> fully opaque
	g.addColorStop(1, "#ffffff");
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, W, H);

	const tex = new THREE.CanvasTexture(canvas);
	tex.needsUpdate = true;
	return tex;
};

export const FLOOR_ALPHA = buildFloorAlpha();
