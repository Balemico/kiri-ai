import { describe, expect, it } from "vitest";
import { pickTrack } from "./music";

describe("pickTrack", () => {
	const tracks = ["a", "b", "c"];

	it("never repeats the previous track when there is another choice", () => {
		for (let i = 0; i < 50; i++) expect(pickTrack(tracks, "b", () => i / 50)).not.toBe("b");
	});

	it("covers every other track across the random range", () => {
		const picks = new Set([0, 0.49, 0.99].map((r) => pickTrack(tracks, "a", () => r)));
		expect(picks).toEqual(new Set(["b", "c"]));
	});

	it("returns the only track even if it was the previous one", () => {
		expect(pickTrack(["solo"], "solo", () => 0.5)).toBe("solo");
	});
});
