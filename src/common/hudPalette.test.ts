import { describe, expect, it } from "vitest";
import { kanjiNumeral } from "./hudPalette";

describe("kanjiNumeral", () => {
	it("writes the round number in kanji", () => {
		expect(kanjiNumeral(1)).toBe("一");
		expect(kanjiNumeral(9)).toBe("九");
		expect(kanjiNumeral(10)).toBe("十");
		expect(kanjiNumeral(12)).toBe("十二");
		expect(kanjiNumeral(20)).toBe("二十");
		expect(kanjiNumeral(21)).toBe("二十一");
	});

	it("falls back to digits outside 1–99", () => {
		expect(kanjiNumeral(0)).toBe("0");
		expect(kanjiNumeral(100)).toBe("100");
	});
});
