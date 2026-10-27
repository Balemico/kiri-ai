// Pure leaf-field math for the lobby's falling maple leaves — no React, no Three (unit-tested).
// Each leaf lives on a deterministic per-index cycle: it DETACHES from the tree-canopy emitter
// box at its own staggered birth time (the field populates leaf by leaf, never mid-air), scales
// in as it detaches, falls with a per-leaf speed, drifts right on a gusting wind, flutters,
// tumbles, and once it crosses the kill line it re-enters from the canopy — growing in again, so
// a respawn reads as a new leaf detaching rather than a pop.

import type { LOBBY } from "./layout";

/** LOBBY.leaves' shape with the literal `as const` types widened, so Leva-tuned overrides fit. */
export type LeafFieldConfig = { [K in keyof typeof LOBBY.leaves]: number };

const TWO_PI = Math.PI * 2;
const fract = (v: number): number => v - Math.floor(v);

/** Deterministic per-leaf hash in [0,1) — same idiom as the InkBrush shader's hash. */
export const leafRandom = (index: number, salt: number): number => fract(Math.abs(Math.sin(index * 127.1 + salt * 311.7)) * 43758.5453);

export interface LeafSpawn {
	x0: number;
	y0: number;
	speed: number;
	cycle: number;
	/** Seconds after the field starts when this leaf FIRST detaches — staggers the population. */
	birth: number;
	scale: number;
	back: boolean;
}

/** Static per-leaf birth parameters (spawn point in the canopy, fall speed, cycle length, …). */
export const leafSpawn = (index: number, cfg: LeafFieldConfig): LeafSpawn => {
	const x0 = cfg.emitterX + (leafRandom(index, 1) - 0.5) * cfg.emitterWidth;
	const y0 = cfg.emitterY - leafRandom(index, 2) * cfg.emitterHeight;
	const speed = cfg.fallSpeed * (1 + (leafRandom(index, 3) - 0.5) * 2 * cfg.fallJitter);
	const cycle = (y0 - cfg.floorY) / speed;
	return {
		x0,
		y0,
		speed,
		cycle,
		birth: leafRandom(index, 4) * cfg.birthStagger, // desynchronise by staggering detachment
		scale: cfg.minScale + leafRandom(index, 5) * (cfg.maxScale - cfg.minScale),
		back: leafRandom(index, 6) < cfg.backRatio,
	};
};

export interface LeafPose {
	x: number;
	y: number;
	rotX: number;
	rotY: number;
	rotZ: number;
	scale: number;
	back: boolean;
}

/**
 * World pose of leaf `index` at field-time `t` (seconds since the field started, NOT wall clock).
 * Pure: same (index, t, cfg) → same pose. Before its birth a leaf is parked at its spawn point
 * at scale 0 (invisible); each (re)birth scales it in over `growSeconds`.
 */
export const leafPose = (index: number, t: number, cfg: LeafFieldConfig): LeafPose => {
	const s = leafSpawn(index, cfg);
	const life = t - s.birth;
	if (life < 0) return { x: s.x0, y: s.y0, rotX: 0, rotY: 0, rotZ: 0, scale: 0, back: s.back };
	const elapsed = life % s.cycle; // seconds since the current (re)birth
	// Detach growth (easeOut): 0 at the instant of (re)birth → full size after growSeconds.
	const g = Math.min(elapsed / Math.max(cfg.growSeconds, 1e-6), 1);
	const grow = g * (2 - g);
	const gust = 1 + cfg.windStrength * Math.sin(t * cfg.windFreq * TWO_PI + leafRandom(index, 7) * TWO_PI);
	const flutter = Math.sin(elapsed * cfg.swayFreq * TWO_PI + leafRandom(index, 8) * TWO_PI) * cfg.sway;
	return {
		x: s.x0 + elapsed * cfg.drift * gust + flutter,
		y: s.y0 - elapsed * s.speed,
		rotX: Math.sin(elapsed * cfg.spinSpeed * 0.7 + leafRandom(index, 9) * TWO_PI) * 0.9,
		rotY: Math.sin(elapsed * cfg.spinSpeed * 0.5 + leafRandom(index, 10) * TWO_PI) * 0.7,
		rotZ: elapsed * cfg.spinSpeed * (0.5 + leafRandom(index, 11)) + leafRandom(index, 12) * TWO_PI,
		scale: s.scale * grow,
		back: s.back,
	};
};
