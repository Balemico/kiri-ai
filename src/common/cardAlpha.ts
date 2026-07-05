import * as THREE from "three";

// A rounded-rectangle alpha mask shared by every card material: opaque interior,
// transparent corners → playing-card rounded corners without touching the GLB mesh.

const W = 512;
const H = 716; // ~5:7 playing-card aspect
const RADIUS = 24; // corner radius in mask pixels (higher = rounder)

const buildAlphaMap = (): THREE.Texture => {
	const canvas = document.createElement("canvas");
	canvas.width = W;
	canvas.height = H;
	const ctx = canvas.getContext("2d")!;
	ctx.clearRect(0, 0, W, H);
	ctx.fillStyle = "#ffffff"; // white = opaque (alphaMap reads luminance)
	ctx.beginPath();
	ctx.moveTo(RADIUS, 0);
	ctx.arcTo(W, 0, W, H, RADIUS);
	ctx.arcTo(W, H, 0, H, RADIUS);
	ctx.arcTo(0, H, 0, 0, RADIUS);
	ctx.arcTo(0, 0, W, 0, RADIUS);
	ctx.closePath();
	ctx.fill();

	const tex = new THREE.CanvasTexture(canvas);
	tex.needsUpdate = true;
	return tex;
};

export const CARD_ALPHA_MAP = buildAlphaMap();
