import { describe, it, expect } from "vitest";
import { createInitialState, reducer } from "./engine";
import { getCardDef } from "./cards";
import type { GameState, GameAction, Stance, Team } from "./types";

const run = (s: GameState, actions: GameAction[]): GameState => actions.reduce((acc, a) => reducer(acc, a), s);

const NORMAL = ["card-approach", "card-charge", "card-balance-strike", "card-high-strike", "card-low-strike"];

/** Deterministic base state with full normal hands and chosen positions/stances. */
const base = (overrides?: {
	redSpace?: number;
	blueSpace?: number;
	redStance?: Stance;
	blueStance?: Stance;
	redHand?: string[];
	blueHand?: string[];
}): GameState => {
	const s = createInitialState({ firstPlayer: "red" });
	return {
		...s,
		red: {
			...s.red,
			hand: overrides?.redHand ?? [...NORMAL],
			space: overrides?.redSpace ?? 0,
			stance: overrides?.redStance ?? "heaven",
			damage: 0,
		},
		blue: {
			...s.blue,
			hand: overrides?.blueHand ?? [...NORMAL],
			space: overrides?.blueSpace ?? 4,
			stance: overrides?.blueStance ?? "heaven",
			damage: 0,
		},
	};
};

const place = (team: Team, cardId: string, slot: "first" | "second", side?: "top" | "bottom"): GameAction => ({
	type: "PLACE_CARD",
	team,
	slot,
	cardId,
	side,
});

const confirm = (team: Team): GameAction => ({ type: "CONFIRM_SELECTION", team });

/** Place both teams' cards (simultaneous model) and confirm each → ready. The `place` helpers in
 *  the red block already carry team "red", the blue block team "blue". */
const placeBoth = (
	s: GameState,
	red: { first: GameAction; second: GameAction },
	blue: { first: GameAction; second: GameAction }
): GameState => run(s, [red.first, red.second, confirm("red"), blue.first, blue.second, confirm("blue")]);

describe("placement (simultaneous)", () => {
	it("PLACE_CARD acts on the named team regardless of `current`", () => {
		const s = reducer(base(), place("blue", "card-charge", "first", "top"));
		expect(s.blue.placed.first?.cardId).toBe("card-charge");
		expect(s.red.placed.first).toBeNull();
	});

	it("both teams confirm → phase advances to ready", () => {
		const s = placeBoth(
			base(),
			{ first: place("red", "card-charge", "first", "top"), second: place("red", "card-balance-strike", "second") },
			{ first: place("blue", "card-charge", "first", "top"), second: place("blue", "card-balance-strike", "second") }
		);
		expect(s.confirmed).toEqual({ red: true, blue: true });
		expect(s.phase).toBe("ready");
	});

	it("only one team confirmed → stays in place phase", () => {
		let s = base();
		s = run(s, [place("red", "card-charge", "first", "top"), place("red", "card-balance-strike", "second"), confirm("red")]);
		expect(s.confirmed).toEqual({ red: true, blue: false });
		expect(s.phase).toBe("place");
	});

	it("a confirmed team can no longer edit its selection", () => {
		let s = base();
		s = run(s, [place("red", "card-charge", "first", "top"), place("red", "card-balance-strike", "second"), confirm("red")]);
		const after = reducer(s, { type: "UNPLACE_CARD", team: "red", slot: "first" });
		expect(after.red.placed.first?.cardId).toBe("card-charge"); // unchanged
	});
});

describe("movement priority", () => {
	it("Charge resolves before Approach (higher priority moves first, no passing)", () => {
		let s = base({ redSpace: 2, blueSpace: 4 });
		s = placeBoth(
			s,
			{ first: place("red", "card-charge", "first", "top"), second: place("red", "card-balance-strike", "second") },
			{ first: place("blue", "card-approach", "first", "top"), second: place("blue", "card-balance-strike", "second") }
		);
		s = reducer(s, { type: "REVEAL_FIRST" });
		// Red charges from 2 toward blue at 4 → stops on blue's space (4); blue then can't move (same space).
		expect(s.red.space).toBe(4);
		expect(s.blue.space).toBe(4);
	});

	it("exposes movement order for staged animation (Charge before Approach → red-first)", () => {
		let s = base({ redSpace: 2, blueSpace: 4 });
		s = placeBoth(
			s,
			{ first: place("red", "card-charge", "first", "top"), second: place("red", "card-balance-strike", "second") },
			{ first: place("blue", "card-approach", "first", "top"), second: place("blue", "card-balance-strike", "second") }
		);
		s = reducer(s, { type: "REVEAL_FIRST" });
		expect(s.lastResolution?.movement.order).toBe("red-first");
		expect(s.lastResolution?.movement.red).toBeGreaterThan(s.lastResolution!.movement.blue);
	});

	it("equal-priority movement animates simultaneously", () => {
		let s = base({ redSpace: 0, blueSpace: 3 });
		s = placeBoth(
			s,
			{ first: place("red", "card-charge", "first", "top"), second: place("red", "card-balance-strike", "second") },
			{ first: place("blue", "card-charge", "first", "top"), second: place("blue", "card-balance-strike", "second") }
		);
		s = reducer(s, { type: "REVEAL_FIRST" });
		expect(s.lastResolution?.movement.order).toBe("simultaneous");
	});

	it("rulebook example 1: two Charges in Heaven, 3 apart → each moves 1, end 1 apart", () => {
		let s = base({ redSpace: 0, blueSpace: 3 });
		s = placeBoth(
			s,
			{ first: place("red", "card-charge", "first", "top"), second: place("red", "card-balance-strike", "second") },
			{ first: place("blue", "card-charge", "first", "top"), second: place("blue", "card-balance-strike", "second") }
		);
		s = reducer(s, { type: "REVEAL_FIRST" });
		expect(s.red.space).toBe(1);
		expect(s.blue.space).toBe(2);
		expect(s.blue.space - s.red.space).toBe(1);
	});
});

describe("change stance", () => {
	it("flips stance without moving", () => {
		let s = base();
		s = placeBoth(
			s,
			{ first: place("red", "card-charge", "first", "bottom"), second: place("red", "card-balance-strike", "second") }, // bottom = change-stance
			{ first: place("blue", "card-balance-strike", "first"), second: place("blue", "card-approach", "second", "top") }
		);
		s = reducer(s, { type: "REVEAL_FIRST" });
		expect(s.red.stance).toBe("earth");
		expect(s.red.space).toBe(0);
	});
});

describe("attacks", () => {
	it("High Strike (heaven, distance 2) hits when opponent is 2 ahead", () => {
		let s = base({ redSpace: 2, blueSpace: 4 });
		s = placeBoth(
			s,
			{ first: place("red", "card-high-strike", "first"), second: place("red", "card-balance-strike", "second") },
			{ first: place("blue", "card-approach", "first", "bottom"), second: place("blue", "card-balance-strike", "second") } // blue retreats (clamped at 4)
		);
		s = reducer(s, { type: "REVEAL_FIRST" });
		expect(s.blue.damage).toBe(1);
		expect(s.red.damage).toBe(0);
	});

	it("wrong stance is a feint (no damage)", () => {
		let s = base({ redSpace: 2, blueSpace: 4, redStance: "earth" });
		s = placeBoth(
			s,
			{ first: place("red", "card-high-strike", "first"), second: place("red", "card-balance-strike", "second") }, // needs heaven
			{ first: place("blue", "card-balance-strike", "first"), second: place("blue", "card-high-strike", "second") }
		);
		s = reducer(s, { type: "REVEAL_FIRST" });
		expect(s.blue.damage).toBe(0);
		expect(s.lastResolution?.red.feint).toBe(true);
		expect(s.lastResolution?.red.wrongStance).toBe(true);
	});

	it("an in-stance attack that only misses on range is a feint but NOT wrong stance", () => {
		// Red in Heaven plays High Strike (heaven, distance 2) but blue is 1 ahead, not 2 → out of range.
		let s = base({ redSpace: 2, blueSpace: 3, redStance: "heaven" });
		s = placeBoth(
			s,
			{ first: place("red", "card-high-strike", "first"), second: place("red", "card-balance-strike", "second") },
			{ first: place("blue", "card-balance-strike", "first"), second: place("blue", "card-high-strike", "second") }
		);
		s = reducer(s, { type: "REVEAL_FIRST" });
		expect(s.blue.damage).toBe(0);
		expect(s.lastResolution?.red.feint).toBe(true);
		expect(s.lastResolution?.red.wrongStance).toBe(false);
	});

	it("both hit = clash, no damage", () => {
		let s = base({ redSpace: 2, blueSpace: 2 });
		s = placeBoth(
			s,
			{ first: place("red", "card-balance-strike", "first"), second: place("red", "card-high-strike", "second") },
			{ first: place("blue", "card-balance-strike", "first"), second: place("blue", "card-high-strike", "second") }
		);
		s = reducer(s, { type: "REVEAL_FIRST" });
		expect(s.lastResolution?.clash).toBe(true);
		expect(s.red.damage).toBe(0);
		expect(s.blue.damage).toBe(0);
	});
});

describe("counter & special", () => {
	it("counter cancels the opponent's hit and damages them", () => {
		// red counters, blue lands a balanced strike (same space). Counter cancels and damages blue.
		let s = base({ redSpace: 2, blueSpace: 2, redHand: ["special-counter", "card-charge"], blueHand: ["card-balance-strike", "card-charge"] });
		s = placeBoth(
			s,
			{ first: place("red", "special-counter", "first"), second: place("red", "card-charge", "second", "bottom") },
			{ first: place("blue", "card-balance-strike", "first"), second: place("blue", "card-charge", "second", "bottom") }
		);
		s = reducer(s, { type: "REVEAL_FIRST" });
		expect(s.blue.damage).toBe(1);
		expect(s.red.damage).toBe(0);
	});

	it("Kesa hits in its current (heaven) stance, THEN switches to earth", () => {
		// Red in Heaven plays Kesa (heaven, distance 0-1, switch→earth) with blue 1 ahead → it lands,
		// and the stance flip happens AFTER the hit (it must not stop the attack from connecting).
		let s = base({ redSpace: 3, blueSpace: 4, redStance: "heaven", redHand: ["special-kesa", "card-charge"], blueHand: ["card-balance-strike", "card-charge"] });
		s = placeBoth(
			s,
			{ first: place("red", "special-kesa", "first"), second: place("red", "card-charge", "second", "bottom") },
			{ first: place("blue", "card-balance-strike", "first"), second: place("blue", "card-charge", "second", "bottom") }
		);
		s = reducer(s, { type: "REVEAL_FIRST" });
		expect(s.blue.damage).toBe(1); // attack connected
		expect(s.lastResolution?.red.hit).toBe(true);
		expect(s.lastResolution?.red.wrongStance).toBe(false);
		expect(s.lastResolution?.red.switchedStance).toBe(true);
		expect(s.red.stance).toBe("earth"); // switched only after attacking
	});

	it("counter does nothing if the opponent does not hit", () => {
		let s = base({ redSpace: 0, blueSpace: 4, redHand: ["special-counter", "card-charge"], blueHand: ["card-approach", "card-charge"] });
		s = placeBoth(
			s,
			{ first: place("red", "special-counter", "first"), second: place("red", "card-charge", "second", "bottom") },
			{ first: place("blue", "card-approach", "first", "top"), second: place("blue", "card-charge", "second", "bottom") }
		);
		s = reducer(s, { type: "REVEAL_FIRST" });
		expect(s.red.damage).toBe(0);
		expect(s.blue.damage).toBe(0);
	});
});

describe("win condition", () => {
	it("second hit defeats a player and ends the game", () => {
		let s = base({ redSpace: 2, blueSpace: 4 });
		s = { ...s, blue: { ...s.blue, damage: 1 } }; // blue already hurt
		s = placeBoth(
			s,
			{ first: place("red", "card-high-strike", "first"), second: place("red", "card-balance-strike", "second") },
			{ first: place("blue", "card-approach", "first", "bottom"), second: place("blue", "card-balance-strike", "second") }
		);
		s = reducer(s, { type: "REVEAL_FIRST" });
		expect(s.blue.damage).toBe(2);
		expect(s.phase).toBe("game-over");
		expect(s.winner).toBe("red");
	});
});

describe("end of round", () => {
	it("first card returns to hand, second is set aside, specials are discarded", () => {
		let s = base({ redHand: ["card-approach", "card-charge", "special-kesa"] });
		s = run(s, [
			place("red", "card-approach", "first", "top"),
			place("red", "special-kesa", "second"),
			confirm("red"),
			place("blue", "card-approach", "first", "top"),
			place("blue", "card-charge", "second", "top"),
			confirm("blue"),
			{ type: "REVEAL_FIRST" },
			{ type: "REVEAL_SECOND" },
			{ type: "END_ROUND" },
		]);
		expect(s.red.hand).toContain("card-approach"); // first card back
		expect(s.red.discarded).toContain("special-kesa"); // special used
		expect(s.red.setAside).toBeNull(); // special was second → nothing set aside
		expect(s.blue.setAside).toBe("card-charge"); // blue's second card set aside
		expect(s.blue.hand).not.toContain("card-charge");
		expect(s.round).toBe(2);
		expect(s.phase).toBe("place");
		expect(s.confirmed).toEqual({ red: false, blue: false }); // reset for the new round
	});

	it("set-aside card returns to hand the following round", () => {
		let s = base();
		// Round 1: blue sets aside its second card (charge).
		s = placeBoth(
			s,
			{ first: place("red", "card-approach", "first", "top"), second: place("red", "card-low-strike", "second") },
			{ first: place("blue", "card-approach", "first", "top"), second: place("blue", "card-charge", "second", "top") }
		);
		s = run(s, [{ type: "REVEAL_FIRST" }, { type: "REVEAL_SECOND" }, { type: "END_ROUND" }]);
		expect(s.blue.setAside).toBe("card-charge");
		expect(s.blue.hand).not.toContain("card-charge");
		// Round 2: play cards both teams still hold, end round → previous set-aside returns.
		s = placeBoth(
			s,
			{ first: place("red", "card-approach", "first", "top"), second: place("red", "card-balance-strike", "second") },
			{ first: place("blue", "card-approach", "first", "top"), second: place("blue", "card-balance-strike", "second") }
		);
		expect(s.phase).toBe("ready"); // both placements succeeded
		s = run(s, [{ type: "REVEAL_FIRST" }, { type: "REVEAL_SECOND" }, { type: "END_ROUND" }]);
		expect(s.blue.hand).toContain("card-charge");
	});
});

describe("initial state", () => {
	it("starts in the place phase with nobody confirmed", () => {
		const s = createInitialState();
		expect(s.phase).toBe("place");
		expect(s.confirmed).toEqual({ red: false, blue: false });
	});

	it("a shared special distribution makes two clients build identical hands (multiplayer)", () => {
		const specials = { red: "special-kesa", blue: "special-zantetsu" } as const;
		const a = createInitialState({ specials });
		const b = createInitialState({ specials });
		expect(a.red.hand).toEqual(b.red.hand);
		expect(a.blue.hand).toEqual(b.blue.hand);
		expect(a.red.hand).toContain("special-kesa");
		expect(a.blue.hand).toContain("special-zantetsu");
	});
});

describe("card definitions", () => {
	it("charge card bottom face is change-stance", () => {
		expect(getCardDef("card-charge")!.faces[1].kind).toBe("change-stance");
	});
});
