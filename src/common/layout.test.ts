import { describe, expect, it } from "vitest";
import { cameraPose, DEFAULT_SCENE_FRAME, frameViewport, INTRO, LOBBY } from "./layout";

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
	it("reveal beats fit inside the flight", () => {
		expect(INTRO.boardRevealAt).toBeLessThan(INTRO.flightDur);
		expect(INTRO.handRevealAt).toBeLessThan(INTRO.flightDur);
	});
	it("leaf emitter sits above the kill line", () => {
		expect(LOBBY.leaves.emitterY).toBeGreaterThan(LOBBY.leaves.floorY);
	});
});
