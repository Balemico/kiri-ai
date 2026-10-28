import { describe, expect, it } from "vitest";
import { cameraPose, CARD_WIDTH, DEFAULT_SCENE_FRAME, fitHandFan, frameViewport, INTRO, LOBBY, portraitLineBand } from "./layout";

describe("cameraPose", () => {
	it("fits by height on wide viewports (same distance regardless of extra width)", () => {
		const wide = cameraPose(DEFAULT_SCENE_FRAME, 4, 30);
		const wider = cameraPose(DEFAULT_SCENE_FRAME, 8, 30);
		expect(wide.z).toBeCloseTo(wider.z, 6);
		// dist = halfHeight / tan(fov/2) = 1.6 / tan(15°)
		expect(wide.z).toBeCloseTo(1.6 / Math.tan((30 * Math.PI) / 360), 6);
	});
	it("dollies back on narrow viewports to keep halfWidth framed", () => {
		const narrow = cameraPose(DEFAULT_SCENE_FRAME, 0.8, 30);
		const expected = DEFAULT_SCENE_FRAME.halfWidth / (Math.tan((30 * Math.PI) / 360) * 0.8);
		expect(narrow.z).toBeCloseTo(expected, 6);
	});
	it("centres y between top and bottom", () => {
		expect(cameraPose(DEFAULT_SCENE_FRAME, 2, 30).y).toBeCloseTo((DEFAULT_SCENE_FRAME.top + DEFAULT_SCENE_FRAME.bottom) / 2, 6);
	});
	it("matches the visible rect frameViewport derives (same fit rule)", () => {
		// Whichever axis forces the camera back sets the visible half-height — both helpers must agree.
		const aspect = 0.9;
		const vp = frameViewport(DEFAULT_SCENE_FRAME, aspect);
		const pose = cameraPose(DEFAULT_SCENE_FRAME, aspect, 30);
		expect((vp.height / 2) / Math.tan((30 * Math.PI) / 360)).toBeCloseTo(pose.z, 6);
	});
});

describe("intro constants", () => {
	it("the approach starts farther than the final pose", () => {
		expect(INTRO.flightStartDist).toBeGreaterThan(1);
		expect(INTRO.flightDur).toBeGreaterThan(0);
	});
	it("leaf emitter sits above the kill line", () => {
		expect(LOBBY.leaves.emitterY).toBeGreaterThan(LOBBY.leaves.floorY);
	});
	it("the natural finish beat covers the whole DOM choreography", () => {
		// Last of the 3 beats fires at menuDelay + 2 staggers; 0.8 covers the longest per-element
		// tail (the caption riding the last beat: 0.25 delay + 0.5 fade).
		expect(INTRO.menuDelay + 2 * INTRO.menuStagger + 0.8).toBeLessThanOrEqual(INTRO.total);
	});
});

describe("portraitLineBand", () => {
	const vp = { bottom: -2.8, height: 5.6 };
	const r = { handReserve: 0.3, hudReserve: 0.1, margin: 0.04, pawnHeight: 0.8, tilt: 0 };

	it("keeps the line between the hand reserve and the HUD reserve minus the pawn's height", () => {
		const { length, centerY } = portraitLineBand(vp, r);
		const top = centerY + length / 2;
		const bottom = centerY - length / 2;
		expect(top + r.pawnHeight).toBeCloseTo(vp.bottom + vp.height * (1 - r.hudReserve - r.margin / 2));
		expect(bottom).toBeCloseTo(vp.bottom + vp.height * (r.handReserve + r.margin / 2));
	});

	it("lengthens the line by 1/cos(tilt) so its raked vertical span still fills the band", () => {
		const flat = portraitLineBand(vp, r).length;
		expect(portraitLineBand(vp, { ...r, tilt: 1 }).length).toBeCloseTo(flat / Math.cos(1));
	});

	it("never returns a negative length when the reserves eat the whole height", () => {
		expect(portraitLineBand(vp, { ...r, handReserve: 0.6, hudReserve: 0.5 }).length).toBe(0);
	});
});

describe("fitHandFan", () => {
	it("keeps the natural step and size when the fan fits", () => {
		expect(fitHandFan(3, 10, 0.3, 1)).toEqual({ spread: 0.6, scale: 1 });
	});

	it("without a minimum step, shrinks step and size together", () => {
		const { spread, scale } = fitHandFan(6, 2, 0.3, 1);
		expect(spread + CARD_WIDTH * scale).toBeCloseTo(2);
		expect(spread / 5 / scale).toBeCloseTo(0.3);
	});

	it("with a minimum step, overlaps more at full size before shrinking", () => {
		const { spread, scale } = fitHandFan(4, 1.3, 0.3, 1, 0.1);
		expect(scale).toBe(1);
		expect(spread + CARD_WIDTH).toBeCloseTo(1.3);
	});

	it("shrinks only once even the minimum step overflows, and never grows the cards", () => {
		const { spread, scale } = fitHandFan(6, 1, 0.3, 1, 0.1);
		expect(spread / 5 / scale).toBeCloseTo(0.1);
		expect(spread + CARD_WIDTH * scale).toBeCloseTo(1);
		expect(fitHandFan(2, 100, 0.3, 1, 0.1).scale).toBe(1);
	});
});
