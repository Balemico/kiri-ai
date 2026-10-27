import { describe, expect, it } from "vitest";
import { VEIL_MIN_LAYERS, easeInOutCubic, easeOutCubic, insideStroke, phaseProgress, rng, veilStrokes } from "./inkMath";

describe("rng", () => {
	it("is deterministic per seed", () => {
		const a = rng(7);
		const b = rng(7);
		expect([a(), a(), a()]).toEqual([b(), b(), b()]);
	});
});

describe("timing", () => {
	it("clamps progress and eases out", () => {
		expect(phaseProgress(-1, 2)).toBe(0);
		expect(phaseProgress(1, 2)).toBe(0.5);
		expect(phaseProgress(5, 2)).toBe(1);
		expect(phaseProgress(0, 0)).toBe(1);
		expect(easeOutCubic(0)).toBe(0);
		expect(easeOutCubic(1)).toBe(1);
		expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
		expect(easeInOutCubic(0)).toBe(0);
		expect(easeInOutCubic(0.5)).toBe(0.5);
		expect(easeInOutCubic(1)).toBe(1);
		expect(easeInOutCubic(0.1)).toBeLessThan(0.1);
	});
});

describe("veilStrokes", () => {
	// The cover is made by translucent brush strokes ADDING UP (no flood): every point of the screen
	// must lie under at least VEIL_MIN_LAYERS of them, at any aspect.
	it.each([0.46, 0.75, 1, 1.3, 1.6, 2, 2.4])("stack at least VEIL_MIN_LAYERS slashes over every point (aspect %f)", (aspect) => {
		for (const seed of [1, 2, 3, 7]) {
			const strokes = veilStrokes(12, aspect, seed);
			for (let sx = 0; sx <= 30; sx++) {
				for (let sy = 0; sy <= 30; sy++) {
					const x = -aspect / 2 + (sx / 30) * aspect;
					const y = -0.5 + sy / 30;
					expect(strokes.filter((st) => insideStroke(st, x, y)).length).toBeGreaterThanOrEqual(VEIL_MIN_LAYERS);
				}
			}
		}
	});

	it("are laid in a random order and cadence, from random sides, all within the pour", () => {
		const strokes = veilStrokes(12, 1.6, 4);
		const starts = strokes.map((st) => st.start);
		expect(Math.min(...starts)).toBe(0);
		expect(new Set(starts).size).toBe(12);
		expect(strokes.every((st) => st.start + st.dur <= 1)).toBe(true);
		// Not top → bottom: the laying order is shuffled…
		const byStart = [...strokes.keys()].sort((a, b) => strokes[a].start - strokes[b].start);
		expect(byStart).not.toEqual([...strokes.keys()]);
		// …at an uneven rhythm, and from both sides.
		const sorted = [...starts].sort((a, b) => a - b);
		const intervals = sorted.slice(1).map((v, i) => v - sorted[i]);
		expect(Math.max(...intervals) / Math.min(...intervals)).toBeGreaterThan(1.5);
		expect(new Set(strokes.map((st) => Math.cos(st.angle) > 0)).size).toBe(2);
	});

	it("dry at different times, all within the drying phase", () => {
		const strokes = veilStrokes(12, 1.6, 4);
		const starts = strokes.map((st) => st.dryStart);
		expect(new Set(starts).size).toBe(12);
		expect(Math.min(...starts)).toBe(0);
		expect(strokes.every((st) => st.dryStart + st.dryDur <= 1 + 1e-9)).toBe(true);
		expect(strokes.every((st) => st.start + st.dur <= 1)).toBe(true);
	});
});
