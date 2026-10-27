/**
 * Pure geometry of a sumi ensō (the zen brush circle) as SVG paths, in a 100×100 viewBox — no React.
 * Built like a real brush gesture rather than a uniform stroke:
 *   • the centreline is a slightly wobbly circle, brushed clockwise from the lower left, stopping short
 *     of closing (the gap IS the ensō);
 *   • a pressure profile sets the width: a heavy rounded head where the brush lands, a body that slowly
 *     thins, a tail that tapers out;
 *   • the solid core dissolves along the tail into bristle strands (kasure) that break into dashes as
 *     the brush runs dry;
 *   • a pale, wider wash under the body for the ink bleeding into the paper.
 * Deterministic (fixed seed), so it's computed once at module load.
 */

export interface EnsoPaths {
	/** Solid ink body (filled). */
	body: string;
	/** Pale bleed under the body (filled). */
	wash: string;
	/** Dry-brush bristle strands (stroked; each entry = one strand's dashes as a single path). */
	strands: { d: string; width: number }[];
	/** Centreline (stroked) — for a draw-on mask. */
	spine: string;
}

const C = 50;
const R = 36;
const START = 0.72 * Math.PI; // lower left (SVG y points down → clockwise on screen)
const SWEEP = 1.82 * Math.PI; // stops short of closing
const W = 9.5; // nominal brush width
const SAMPLES = 220;

// Small deterministic hash → [0, 1).
const hash = (a: number, b: number): number => {
	const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
	return s - Math.floor(s);
};
const smooth = (e0: number, e1: number, x: number): number => {
	const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
	return t * t * (3 - 2 * t);
};

/** Radius along the gesture: a hand-drawn circle is never round. */
const radius = (t: number): number => {
	const a = START + SWEEP * t;
	return R * (1 + 0.035 * Math.sin(2 * a + 0.7) + 0.012 * Math.sin(5 * a + 1.9)) + 1.2 * t; // drifts outward a touch
};

/** Brush width along the gesture (pressure profile). */
const width = (t: number): number => {
	const head = 0.7 + 0.5 * smooth(0, 0.05, t); // lands and presses
	const body = 1.15 - 0.4 * smooth(0.05, 0.75, t); // slowly lightens
	const tail = 1 - 0.85 * smooth(0.72, 1, t); // tapers out
	return W * Math.min(head, body) * tail;
};

/** Share of the width still solid ink: the core gives way to bristle strands along the tail. */
const solid = (t: number): number => 1 - smooth(0.55, 0.86, t);

const point = (t: number, off: number): [number, number] => {
	const a = START + SWEEP * t;
	const r = radius(t) + off;
	return [C + r * Math.cos(a), C + r * Math.sin(a)];
};
const fmt = ([x, y]: [number, number]) => `${x.toFixed(2)} ${y.toFixed(2)}`;

const ribbon = (half: (t: number) => number, tMax = 1): string => {
	const outer: string[] = [];
	const inner: string[] = [];
	for (let i = 0; i <= SAMPLES; i++) {
		const t = (i / SAMPLES) * tMax;
		const h = half(t);
		// Ink pools a little toward the OUTSIDE of the curve (the brush belly trails outward).
		outer.push(fmt(point(t, h * 1.08)));
		inner.push(fmt(point(t, -h * 0.92)));
	}
	return `M ${outer.join(" L ")} L ${inner.reverse().join(" L ")} Z`;
};

const buildStrands = (): EnsoPaths["strands"] => {
	const strands: EnsoPaths["strands"] = [];
	const N = 9;
	for (let s = 0; s < N; s++) {
		const lane = (s / (N - 1) - 0.5) * 0.9; // across the brush, −0.45…0.45 of its width
		const from = 0.48 + 0.08 * hash(s, 1);
		const to = 0.86 + 0.14 * hash(s, 2);
		const sw = 0.55 + 1.1 * hash(s, 3);
		const parts: string[] = [];
		let run: string[] = [];
		for (let i = 0; i <= SAMPLES; i++) {
			const t = i / SAMPLES;
			if (t < from || t > to) continue;
			// Gaps open up as the brush runs dry; each strand breaks at its own spots.
			const dry = smooth(0.6, 1, t) * 0.75;
			const on = hash(s * 31 + 7, Math.floor(t * 70)) > dry;
			if (on) run.push(fmt(point(t, lane * width(t) * 1.1)));
			if ((!on || i === SAMPLES || t + 1 / SAMPLES > to) && run.length) {
				if (run.length > 1) parts.push(`M ${run.join(" L ")}`);
				run = [];
			}
		}
		if (parts.length) strands.push({ d: parts.join(" "), width: sw });
	}
	return strands;
};

const buildSpine = (): string => {
	// Starts a little BEHIND the gesture so a butt-capped draw-on mask uncovers the whole round head.
	const pts: string[] = [];
	for (let i = -8; i <= SAMPLES; i++) pts.push(fmt(point(i / SAMPLES, 0)));
	return `M ${pts.join(" L ")}`;
};

export const ENSO: EnsoPaths = {
	body: ribbon((t) => (width(t) * solid(t)) / 2, 0.9),
	wash: ribbon((t) => (width(t) * 1.55 * (1 - 0.6 * smooth(0.5, 1, t))) / 2),
	strands: buildStrands(),
	spine: buildSpine(),
};

/** The head's round blob where the brush lands (circle centre + radius). */
export const ENSO_HEAD = (() => {
	const [cx, cy] = point(0.012, 0.6);
	return { cx, cy, r: width(0.012) * 0.54 };
})();
