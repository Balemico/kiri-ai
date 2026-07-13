import { describe, expect, it } from "vitest";
import { inkFrameBlend, inkFrameSrc } from "./inkFrames";

describe("inkFrameBlend", () => {
	it("starts on the first frame", () => {
		expect(inkFrameBlend(0, 12)).toEqual({ a: 0, b: 1, blend: 0 });
	});

	it("ends exactly on the last frame with no incoming blend", () => {
		expect(inkFrameBlend(1, 12)).toEqual({ a: 11, b: 11, blend: 0 });
	});

	it("blends adjacent frames mid-way", () => {
		const { a, b, blend } = inkFrameBlend(0.5, 12);
		expect(a).toBe(5);
		expect(b).toBe(6);
		expect(blend).toBeCloseTo(0.5);
	});

	it("clamps out-of-range progress", () => {
		expect(inkFrameBlend(-0.5, 12).a).toBe(0);
		expect(inkFrameBlend(1.5, 12)).toEqual({ a: 11, b: 11, blend: 0 });
	});
});

describe("inkFrameSrc", () => {
	it("builds zero-padded 1-based frame paths from 0-based indices", () => {
		expect(inkFrameSrc("stroke-1", 0)).toBe("/images/intro/frames/stroke-1-f01.png");
		expect(inkFrameSrc("veil-3", 11)).toBe("/images/intro/frames/veil-3-f12.png");
	});
});
