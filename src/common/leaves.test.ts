import { describe, expect, it } from "vitest";
import { LOBBY } from "./layout";
import { leafPose, leafRandom, leafSpawn } from "./leaves";

const cfg = LOBBY.leaves;

describe("leafRandom", () => {
	it("is deterministic and in [0,1)", () => {
		for (let i = 0; i < 50; i++) {
			const v = leafRandom(i, 3);
			expect(v).toBe(leafRandom(i, 3));
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});
	it("differs across salts", () => {
		expect(leafRandom(7, 1)).not.toBe(leafRandom(7, 2));
	});
});

describe("leafSpawn", () => {
	it("births every leaf inside the canopy emitter box", () => {
		for (let i = 0; i < cfg.count; i++) {
			const s = leafSpawn(i, cfg);
			expect(Math.abs(s.x0 - cfg.emitterX)).toBeLessThanOrEqual(cfg.emitterWidth / 2);
			expect(s.y0).toBeLessThanOrEqual(cfg.emitterY);
			expect(s.y0).toBeGreaterThanOrEqual(cfg.emitterY - cfg.emitterHeight);
		}
	});
	it("cycle spans the fall from the spawn point to the kill line", () => {
		const s = leafSpawn(3, cfg);
		expect(s.cycle).toBeCloseTo((s.y0 - cfg.floorY) / s.speed, 6);
	});
});

describe("leafPose", () => {
	it("always stays between the kill line and the emitter top", () => {
		for (let i = 0; i < cfg.count; i++) {
			for (const t of [0, 1.7, 12.3, 55.5, 240.1]) {
				const p = leafPose(i, t, cfg);
				expect(p.y).toBeGreaterThanOrEqual(cfg.floorY - 1e-6);
				expect(p.y).toBeLessThanOrEqual(cfg.emitterY + 1e-6);
			}
		}
	});
	it("falls monotonically within one cycle", () => {
		const s = leafSpawn(5, cfg);
		// Sample twice inside the same cycle (start of the cycle after phase alignment).
		const t0 = s.cycle - s.phase + 0.01; // localT ≈ 0
		const p0 = leafPose(5, t0, cfg);
		const p1 = leafPose(5, t0 + s.cycle * 0.3, cfg);
		expect(p1.y).toBeLessThan(p0.y);
	});
	it("re-enters from the canopy after a full cycle (x resets near the spawn column)", () => {
		const s = leafSpawn(9, cfg);
		const t0 = s.cycle - s.phase + 0.01;
		const born = leafPose(9, t0, cfg);
		const reborn = leafPose(9, t0 + s.cycle, cfg);
		expect(Math.abs(reborn.y - born.y)).toBeLessThan(0.05);
		expect(Math.abs(reborn.x - born.x)).toBeLessThan(cfg.sway * 2 + 0.05);
	});
	it("splits front/back deterministically by backRatio", () => {
		const backs = Array.from({ length: cfg.count }, (_, i) => leafPose(i, 0, cfg).back);
		expect(backs.filter(Boolean).length).toBeGreaterThan(0);
		expect(backs.filter(Boolean).length).toBeLessThan(cfg.count);
		expect(backs).toEqual(Array.from({ length: cfg.count }, (_, i) => leafPose(i, 99, cfg).back));
	});
});
