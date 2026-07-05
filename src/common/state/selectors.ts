import type { CardId, GameState, PlayerState, Side, Slot, Team } from "../game";
import { getCardDef, type CardDef } from "../game";

export type CardLocation = "hand" | "slot" | "setAside";

export interface CardView {
	key: string;
	cardId: CardId;
	team: Team;
	def: CardDef;
	location: CardLocation;
	slot?: Slot;
	side: Side | null;
	faceUp: boolean;
	isMine: boolean;
	interactive: boolean;
}

/** A team may still edit its selection: it's the place phase and that team hasn't confirmed yet. */
export const isPlacing = (state: GameState, team: Team): boolean => state.phase === "place" && !state.confirmed[team];

/** Whether the given team's card in `slot` is visible to `viewerTeam` this phase. */
const slotFaceUp = (state: GameState, viewerTeam: Team, team: Team, slot: Slot): boolean => {
	switch (state.phase) {
		case "reveal-first":
			return slot === "first";
		case "reveal-second":
		case "game-over":
			return true;
		case "place":
			return team === viewerTeam; // the viewer sees ONLY their own committed cards while placing
		default:
			return false; // "ready": everything face-down until the reveal
	}
};

const toView = (
	state: GameState,
	viewerTeam: Team,
	team: Team,
	cardId: CardId,
	location: CardLocation,
	side: Side | null,
	slot: Slot | undefined,
	faceUp: boolean
): CardView | null => {
	const def = getCardDef(cardId);
	if (!def) return null;
	// A hand card is only interactive while there's an action slot to fill — once both are placed, tapping
	// the hand shouldn't lift a third card (you can still tap/drag a committed card back to free a slot).
	const hasFreeSlot = !state[team].placed.first || !state[team].placed.second;
	const interactive =
		team === viewerTeam && isPlacing(state, team) && location !== "setAside" && (location !== "hand" || hasFreeSlot);
	return {
		// Stable per card so it keeps its instance (and tweens) across hand → slot moves.
		key: `${team}-${cardId}`,
		cardId,
		team,
		def,
		location,
		slot,
		side,
		faceUp,
		isMine: team === viewerTeam,
		interactive,
	};
};

/** Cards in the viewer's own hand (rendered as the fan). */
export const currentHandViews = (state: GameState, viewerTeam: Team): CardView[] => {
	const faceUp = isPlacing(state, viewerTeam);
	return state[viewerTeam].hand
		.map((cardId) => toView(state, viewerTeam, viewerTeam, cardId, "hand", null, undefined, faceUp))
		.filter((v): v is CardView => v !== null);
};

/** All committed cards from both teams, with their slot zone visibility from the viewer's perspective. */
export const placedViews = (state: GameState, viewerTeam: Team): CardView[] => {
	const views: CardView[] = [];
	(["red", "blue"] as Team[]).forEach((team) => {
		(["first", "second"] as Slot[]).forEach((slot) => {
			const placed = state[team].placed[slot];
			if (!placed) return;
			const v = toView(state, viewerTeam, team, placed.cardId, "slot", placed.side, slot, slotFaceUp(state, viewerTeam, team, slot));
			if (v) views.push(v);
		});
	});
	return views;
};

/** Set-aside cards, kept face up at the side of the board (visible to both players). */
export const setAsideViews = (state: GameState, viewerTeam: Team): CardView[] => {
	const views: CardView[] = [];
	(["red", "blue"] as Team[]).forEach((team) => {
		const cardId = state[team].setAside;
		if (!cardId) return;
		const v = toView(state, viewerTeam, team, cardId, "setAside", null, undefined, true);
		if (v) views.push(v);
	});
	return views;
};

export const placedCount = (player: PlayerState): number =>
	(player.placed.first ? 1 : 0) + (player.placed.second ? 1 : 0);

/** Whether `team` can lock in its selection (still placing and both slots filled). */
export const canConfirm = (state: GameState, team: Team): boolean => isPlacing(state, team) && placedCount(state[team]) === 2;
