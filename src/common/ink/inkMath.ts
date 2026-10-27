/** Pure timing/layout math for the sumi ink shader — no three, no React (unit-tested). */

/** Tiny seeded PRNG (mulberry32): the same seed always yields the same sequence. */
export const rng = (seed: number): (() => number) => {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** 0..1 progress of a timed phase, clamped (duration ≤ 0 → already done). */
export const phaseProgress = (elapsed: number, duration: number): number => (duration <= 0 ? 1 : clamp01(elapsed / duration));

/** Ease-out cubic — ink lands fast and slows as the paper drinks it. */
export const easeOutCubic = (t: number): number => 1 - (1 - clamp01(t)) ** 3;

export interface VeilStroke {
	/** Centre of the stroke, in screen-height units: x ∈ [−aspect/2, aspect/2], y ∈ [−½, ½] (y up). */
	cx: number;
	cy: number;
	/** Travel direction of the brush, radians (alternates left→right / right→left). */
	angle: number;
	/** Length and full width, screen-height units. */
	length: number;
	width: number;
	/** Bow of the centre line (signed), screen-height units. */
	bend: number;
	/** Fraction of the pour when this slash starts, and how much of the pour it takes. */
	start: number;
	dur: number;
}

/**
 * Giant brush slashes for the full-screen veil: `count` near-horizontal strokes stacked down the
 * screen, alternating direction, overlapping their neighbours (1.7 × spacing) so their bodies ink
 * almost all of it — the shader's closing flood seals the rest (dry-brush streaks and tapered
 * tips leave gaps by design), so the swap is always fully covered.
 */
export const veilStrokes = (count: number, aspect: number, seed = 1): VeilStroke[] => {
	const rand = rng(seed);
	const maxTilt = 0.3;
	// The tilt drops each slash by up to tan(maxTilt)·aspect/2 at the screen sides: stack them over
	// a band that much taller than the screen, so the top-right / bottom-left corners stay inked.
	const reach = 1 + Math.tan(maxTilt) * aspect;
	const width = (1.7 * reach) / count;
	// Combed order (0, 2, 4…, then 1, 3, 5…): the first pass leaves paper between the slashes, so
	// each blow reads on its own before the second pass closes the gaps.
	const order = [...Array.from({ length: count }, (_, i) => i).filter((i) => i % 2 === 0), ...Array.from({ length: count }, (_, i) => i).filter((i) => i % 2 === 1)];
	return Array.from({ length: count }, (_, i) => {
		const slot = order.indexOf(i);
		const tilt = -0.22 + (rand() - 0.5) * 0.16;
		const leftToRight = i % 2 === 0;
		const angle = leftToRight ? tilt : Math.PI + tilt;
		return {
			cx: (rand() - 0.5) * 0.1,
			cy: reach / 2 - ((i + 0.5) / count) * reach + (rand() - 0.5) * 0.04,
			angle,
			length: (aspect + 1.0) / Math.cos(tilt) + width,
			width,
			bend: (rand() - 0.5) * 0.12,
			start: (slot * 0.62) / count + rand() * 0.03,
			dur: 0.36,
		};
	});
};

/** Half-width of a slash at `s` along it (0..1): full through the body, tapering on the tail. */
export const strokeHalfWidth = (stroke: VeilStroke, s: number): number => (stroke.width / 2) * (s < 0.5 ? 1 : 1 - 0.7 * Math.min(1, (s - 0.5) / 0.5));

/** Whether a point (screen-height units) lies inside a slash's body (ignoring bristle gaps and bow). */
export const insideStroke = (stroke: VeilStroke, x: number, y: number, fill = 0.9): boolean => {
	const dx = x - stroke.cx;
	const dy = y - stroke.cy;
	const along = dx * Math.cos(stroke.angle) + dy * Math.sin(stroke.angle);
	const across = -dx * Math.sin(stroke.angle) + dy * Math.cos(stroke.angle);
	const s = along / stroke.length + 0.5;
	return s >= 0 && s <= 1 && Math.abs(across) <= strokeHalfWidth(stroke, s) * fill - Math.abs(stroke.bend);
};
