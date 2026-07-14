import { describe, expect, it } from "vitest";
import { WIPE_SCALE, inkWipeSrc, wipeTravel } from "./inkWipe";

describe("wipeTravel", () => {
	it("starts parked fully left of the box", () => {
		expect(wipeTravel(0)).toBe("0%");
	});

	it("ends with the solid section covering the box", () => {
		const end = parseFloat(wipeTravel(1));
		expect(end).toBeCloseTo(((WIPE_SCALE - 1) / WIPE_SCALE) * 100, 4);
		expect(wipeTravel(1).endsWith("%")).toBe(true);
	});

	it("moves monotonically with progress", () => {
		expect(parseFloat(wipeTravel(0.25))).toBeLessThan(parseFloat(wipeTravel(0.5)));
		expect(parseFloat(wipeTravel(0.5))).toBeLessThan(parseFloat(wipeTravel(0.75)));
	});

	it("clamps out-of-range progress", () => {
		expect(wipeTravel(-0.5)).toBe(wipeTravel(0));
		expect(wipeTravel(1.5)).toBe(wipeTravel(1));
	});
});

describe("inkWipeSrc", () => {
	it("builds 1-based ramp paths from 0-based variants", () => {
		expect(inkWipeSrc(0)).toBe("/images/intro/wipe-1.png");
		expect(inkWipeSrc(2)).toBe("/images/intro/wipe-3.png");
	});
});
