import type { CardId, GameAction, GameState, PlayerState, Slot, Team } from "./types";
import { NORMAL_CARDS, distributeSpecials, isSpecial } from "./cards";
import { resolveAction, RED_START, BLUE_START } from "./rules";

export interface EngineConfig {
	firstPlayer?: Team;
	/** Pre-agreed special distribution so two networked clients build an IDENTICAL initial state
	 *  (the shuffle in `distributeSpecials` is otherwise random per client). */
	specials?: { red: CardId; blue: CardId };
}

const SLOTS: Slot[] = ["first", "second"];

const makePlayer = (special: CardId, space: number): PlayerState => ({
	hand: [...NORMAL_CARDS.map((c) => c.id), special],
	placed: { first: null, second: null },
	setAside: null,
	discarded: [],
	space,
	stance: "heaven",
	damage: 0,
});

export const createInitialState = (config: EngineConfig = {}): GameState => {
	const specials = config.specials ?? distributeSpecials();
	const firstPlayer = config.firstPlayer ?? "red";
	return {
		red: makePlayer(specials.red, RED_START),
		blue: makePlayer(specials.blue, BLUE_START),
		current: firstPlayer,
		phase: "place",
		confirmed: { red: false, blue: false },
		round: 1,
		winner: null,
		lastResolution: null,
	};
};

const bothPlaced = (p: PlayerState): boolean => !!p.placed.first && !!p.placed.second;

/** End-of-round card rotation for a single player (see rulebook "End of Round"). */
const rotateCards = (p: PlayerState): PlayerState => {
	const hand = [...p.hand];
	const discarded = [...p.discarded];

	// Previously set-aside card returns to hand.
	if (p.setAside) hand.push(p.setAside);

	// First card: back to hand (or discarded if it was a special).
	const first = p.placed.first?.cardId;
	if (first) {
		if (isSpecial(first)) discarded.push(first);
		else hand.push(first);
	}

	// Second card: set aside for one round (or discarded if special → nothing set aside).
	const second = p.placed.second?.cardId;
	let setAside: CardId | null = null;
	if (second) {
		if (isSpecial(second)) discarded.push(second);
		else setAside = second;
	}

	return { ...p, hand, discarded, setAside, placed: { first: null, second: null } };
};

export const reducer = (state: GameState, action: GameAction): GameState => {
	switch (action.type) {
		case "PLACE_CARD": {
			const team = action.team;
			if (state.phase !== "place" || state.confirmed[team]) return state; // can't edit once confirmed
			const player = state[team];
			if (!player.hand.includes(action.cardId)) return state;
			if (player.placed[action.slot]) return state; // slot already taken
			const player2: PlayerState = {
				...player,
				hand: player.hand.filter((c) => c !== action.cardId),
				placed: {
					...player.placed,
					[action.slot]: { cardId: action.cardId, side: action.side ?? null, revealed: false },
				},
			};
			return { ...state, [team]: player2 };
		}

		case "UNPLACE_CARD": {
			const team = action.team;
			if (state.phase !== "place" || state.confirmed[team]) return state;
			const player = state[team];
			const placed = player.placed[action.slot];
			if (!placed) return state;
			const player2: PlayerState = {
				...player,
				hand: [...player.hand, placed.cardId],
				placed: { ...player.placed, [action.slot]: null },
			};
			return { ...state, [team]: player2 };
		}

		case "CONFIRM_SELECTION": {
			const team = action.team;
			if (state.phase !== "place" || state.confirmed[team]) return state;
			if (!bothPlaced(state[team])) return state;
			const confirmed = { ...state.confirmed, [team]: true };
			const both = confirmed.red && confirmed.blue;
			// Both locked in → reveal is ready. `current` pinned to red so both clients agree.
			return { ...state, confirmed, phase: both ? "ready" : "place", current: both ? "red" : state.current };
		}

		case "REVEAL_FIRST": {
			if (state.phase !== "ready") return state;
			const revealed = markRevealed(state, "first");
			const { red, blue, resolution, winner } = resolveAction(revealed, "first");
			return {
				...revealed,
				red,
				blue,
				lastResolution: resolution,
				phase: winner ? "game-over" : "reveal-first",
				winner,
			};
		}

		case "REVEAL_SECOND": {
			if (state.phase !== "reveal-first") return state;
			const revealed = markRevealed(state, "second");
			const { red, blue, resolution, winner } = resolveAction(revealed, "second");
			return {
				...revealed,
				red,
				blue,
				lastResolution: resolution,
				phase: winner ? "game-over" : "reveal-second",
				winner,
			};
		}

		case "END_ROUND": {
			if (state.phase !== "reveal-second") return state;
			return {
				...state,
				red: rotateCards(state.red),
				blue: rotateCards(state.blue),
				round: state.round + 1,
				current: "red",
				phase: "place",
				confirmed: { red: false, blue: false },
				lastResolution: null,
			};
		}

		case "RESET_GAME":
			return createInitialState({ firstPlayer: "red" });

		default:
			return state;
	}
};

const markRevealed = (state: GameState, slot: Slot): GameState => {
	const reveal = (p: PlayerState): PlayerState => {
		const placed = p.placed[slot];
		if (!placed) return p;
		return { ...p, placed: { ...p.placed, [slot]: { ...placed, revealed: true } } };
	};
	return { ...state, red: reveal(state.red), blue: reveal(state.blue) };
};

export { SLOTS };
