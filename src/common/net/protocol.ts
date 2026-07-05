import type { CardId, GameAction, PlayerState, Side, Slot, Team } from "../game";

/** A single committed card, transmitted at confirm time so the peer's engine can resolve the round. */
export interface Placement {
	slot: Slot;
	cardId: CardId;
	side: Side | null;
}

/**
 * Messages exchanged over the Trystero data channel. The engine is deterministic, so we only relay
 * the CONFIRMED beats — placement edits stay local until a player locks in.
 *
 *  - `hello`  guest → host once connected, asking for the shared setup (also guarantees both message
 *             listeners are registered before `init` flows).
 *  - `init`   host → guest: the agreed special distribution + the host's colour (guest takes the other).
 *  - `commit` either → peer: a player locked in their 2 cards (opponent stores them face-down).
 *  - `phase`  host → guest: a shared phase action (reveal first/second, end round).
 */
export type NetMessage =
	| { kind: "hello" }
	| { kind: "init"; specials: { red: CardId; blue: CardId }; hostTeam: Team }
	| { kind: "commit"; team: Team; placements: Placement[] }
	| { kind: "phase"; action: GameAction };

/** Extract a player's committed cards as a transmittable list. */
export const placementsOf = (player: PlayerState): Placement[] =>
	(["first", "second"] as Slot[])
		.map((slot) => {
			const placed = player.placed[slot];
			return placed ? { slot, cardId: placed.cardId, side: placed.side } : null;
		})
		.filter((p): p is Placement => p !== null);
