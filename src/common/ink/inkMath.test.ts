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
	// The shader's flood guarantees the final cover; the slashes' bodies should still ink nearly all
	// of the screen by themselves, so the flood only seals dry-brush gaps (never reads as a wipe).
	it.each([0.46, 1, 1.6, 2.4])("their bodies ink at least 90 percent of the screen (aspect %f)", (aspect) => {
		for (const seed of [1, 2, 3]) {
			const strokes = veilStrokes(6, aspect, seed);
			let inked = 0;
			let total = 0;
			for (let sx = 0; sx <= 30; sx++) {
				for (let sy = 0; sy <= 30; sy++) {
					total++;
					if (strokes.some((st) => insideStroke(st, -aspect / 2 + (sx / 30) * aspect, -0.5 + sy / 30))) inked++;
				}
			}
			expect(inked / total).toBeGreaterThanOrEqual(0.9);
		}
	});

	it("alternate direction and start staggered from the first beat", () => {
		const strokes = veilStrokes(6, 1.6, 4);
		expect(Math.cos(strokes[0].angle)).toBeGreaterThan(0);
		expect(Math.cos(strokes[1].angle)).toBeLessThan(0);
		expect(strokes[0].start).toBeLessThan(0.05);
		// Combed: the even slashes all land before any odd one.
		expect(Math.max(strokes[0].start, strokes[2].start, strokes[4].start)).toBeLessThan(Math.min(strokes[1].start, strokes[3].start, strokes[5].start));
	});

	it("dry at different times, all within the drying phase", () => {
		const strokes = veilStrokes(6, 1.6, 4);
		const starts = strokes.map((st) => st.dryStart);
		expect(new Set(starts).size).toBe(6);
		expect(Math.min(...starts)).toBe(0);
		expect(strokes.every((st) => st.dryStart + st.dryDur <= 1 + 1e-9)).toBe(true);
		expect(strokes.every((st) => st.start + st.dur <= 1)).toBe(true);
	});
});
