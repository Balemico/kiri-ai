import { describe, expect, it } from "vitest";
import { easeInOutCubic, easeOutCubic, insideStroke, phaseProgress, rng, veilStrokes } from "./inkMath";

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
	// The cover is made by the brush strokes alone (no flood): their bodies must ink every point of
	// the screen, at any aspect.
	it.each([0.46, 0.75, 1, 1.3, 1.6, 2, 2.4])("their bodies ink the whole screen (aspect %f)", (aspect) => {
		for (const seed of [1, 2, 3, 7]) {
			const strokes = veilStrokes(12, aspect, seed);
			for (let sx = 0; sx <= 40; sx++) {
				for (let sy = 0; sy <= 40; sy++) {
					expect(strokes.some((st) => insideStroke(st, -aspect / 2 + (sx / 40) * aspect, -0.5 + sy / 40))).toBe(true);
				}
			}
		}
	});

	it("alternate direction and start staggered from the first beat", () => {
		const strokes = veilStrokes(12, 1.6, 4);
		expect(Math.cos(strokes[0].angle)).toBeGreaterThan(0);
		expect(Math.cos(strokes[1].angle)).toBeLessThan(0);
		expect(strokes[0].start).toBeLessThan(0.05);
		// Laid top → bottom: each slash starts after the one above it.
		strokes.slice(1).forEach((st, i) => expect(st.start).toBeGreaterThan(strokes[i].start));
		expect(strokes[1].cy).toBeLessThan(strokes[0].cy);
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
