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

/** Ease-in-out cubic — a reveal that starts and settles softly. */
export const easeInOutCubic = (t: number): number => {
	const x = clamp01(t);
	return x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
};

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
	/** Fraction of the drying when this slash starts drying, and how much of it it takes —
	 *  shuffled, so the slashes dry at different times and the scene shows through piecewise. */
	dryStart: number;
	dryDur: number;
}

/**
 * Giant brush slashes for the full-screen veil: `count` near-horizontal strokes stacked down the
 * screen, each `widthFactor` stacking steps wide so they overlap deeply: every point lies under at
 * least VEIL_MIN_LAYERS of them (tested across aspects). The slashes are translucent and simply
 * ADD UP until the screen is full — there is no flood that turns it opaque on its own.
 */
export const veilStrokes = (count: number, aspect: number, seed = 1, widthFactor = VEIL_WIDTH_FACTOR, lengthExtra = VEIL_LENGTH_EXTRA, bandPad = BAND_PAD): VeilStroke[] => {
	const rand = rng(seed);
	const maxTilt = 0.3;
	// The tilt drops each slash by up to tan(maxTilt)·aspect/2 at the screen sides: stack them over
	// a band that much taller than the screen, so the top-right / bottom-left corners stay inked.
	const reach = 1 + Math.tan(maxTilt) * aspect;
	const width = (widthFactor * reach) / count;
	const band = reach + width * bandPad;
	const baseTilt = -0.22 + (rand() - 0.5) * 0.12;
	// Laying mirrors the drying: a seeded SHUFFLE (own generator — never perturbs the geometry), at
	// an irregular cadence (random gaps: some blows close together, some after a beat), each slash
	// from a random side. Coverage is geometric, so whatever the order the screen is fully opaque
	// only once the LAST slash lands — the brush strokes themselves cover it (no flood).
	const pourRand = rng(seed + 53);
	const pourOrder = Array.from({ length: count }, (_, i) => i).sort(() => pourRand() - 0.5);
	const gaps = Array.from({ length: count }, (_, k) => (k === 0 ? 0 : 0.35 + pourRand() * 1.3));
	const cumulative = gaps.map((_, k) => gaps.slice(0, k + 1).reduce((a, g) => a + g, 0));
	const lastStart = 0.62;
	const startOf = (slot: number) => (cumulative[count - 1] > 0 ? (cumulative[slot] / cumulative[count - 1]) * lastStart : 0);
	const fromLeft = Array.from({ length: count }, () => pourRand() < 0.5);
	// Drying order: a seeded shuffle from its OWN generator, so it never perturbs the geometry.
	const dryRand = rng(seed + 101);
	const dryOrder = Array.from({ length: count }, (_, i) => i).sort(() => dryRand() - 0.5);
	const dryDur = 0.45;
	return Array.from({ length: count }, (_, i) => {
		const drySlot = dryOrder.indexOf(i);
		const pourSlot = pourOrder.indexOf(i);
		// Near-parallel: one shared tilt, a whisper of variation — slashes with independent tilts
		// diverge across the screen and open wedge-shaped gaps between neighbours.
		const tilt = baseTilt + (rand() - 0.5) * 0.04;
		const angle = fromLeft[i] ? tilt : Math.PI + tilt;
		return {
			cx: (rand() - 0.5) * 0.1,
			// Jitter and bow scale with the stroke (not the screen), so thin slashes keep their overlap.
			cy: band / 2 - ((i + 0.5) / count) * band + (rand() - 0.5) * 0.15 * (band / count),
			angle,
			length: (aspect + lengthExtra) / Math.cos(tilt) + width,
			width,
			bend: (rand() - 0.5) * 0.3 * width,
			start: startOf(pourSlot),
			dur: 0.36,
			dryStart: count > 1 ? (drySlot / (count - 1)) * (1 - dryDur) : 0,
			dryDur,
		};
	});
};

/** How much a veil slash narrows toward its tip (0.35 → the tip keeps 65% of the body width): milder
 *  than a free slash, so the tails can't leave the screen's corners uncovered. Shared with the shader. */
export const VEIL_TIP_TAPER = 0.35;

/** Slash width as a multiple of the stacking step: the slashes are translucent layers, so each
 *  point must lie under several of them (see VEIL_MIN_LAYERS). */
export const VEIL_WIDTH_FACTOR = 8;

/** Extra stacking band beyond `reach`, in slash widths (so the screen edges get full overlap depth). */
export const BAND_PAD = 0.3;

/** Fewest slashes stacked over any point of the screen (tested): with translucent layers this is
 *  what makes the cover (practically) opaque — ~5 on average, never fewer than this. */
export const VEIL_MIN_LAYERS = 3;

/** Extra length (screen heights) past the screen width, so the tapered ends land off-screen. */
export const VEIL_LENGTH_EXTRA = 1.0;

/** Half-width of a slash at `s` along it (0..1): full through the body, tapering on the tail. */
export const strokeHalfWidth = (stroke: VeilStroke, s: number): number => (stroke.width / 2) * (s < 0.5 ? 1 : 1 - VEIL_TIP_TAPER * Math.min(1, (s - 0.5) / 0.5));

/** Whether a point (screen-height units) lies inside a slash's body (ignoring bristle gaps and bow). */
export const insideStroke = (stroke: VeilStroke, x: number, y: number, fill = 0.9): boolean => {
	const dx = x - stroke.cx;
	const dy = y - stroke.cy;
	const along = dx * Math.cos(stroke.angle) + dy * Math.sin(stroke.angle);
	const across = -dx * Math.sin(stroke.angle) + dy * Math.cos(stroke.angle);
	const s = along / stroke.length + 0.5;
	return s >= 0 && s <= 1 && Math.abs(across) <= strokeHalfWidth(stroke, s) * fill - Math.abs(stroke.bend);
};
