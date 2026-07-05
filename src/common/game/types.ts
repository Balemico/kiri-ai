// Pure domain types for Kiri-ai. No React, no Three.js here.

export type Stance = "heaven" | "earth";
export type Team = "red" | "blue";

/** The chosen face of a movement card (top / bottom of the physical card). */
export type Side = "top" | "bottom";

/** first = card closest to the opponent (resolved first), second = farther card. */
export type Slot = "first" | "second";

/** Id of a card *definition*, e.g. "card-approach" (no team prefix, no side suffix). */
export type CardId = string;

export type EffectKind = "movement" | "change-stance" | "attack" | "counter";

/** A single usable face of a card. */
export interface CardEffect {
	kind: EffectKind;
	/** movement: spaces toward the opponent (negative = away / retreat). */
	amount?: number;
	/** attack: stances in which the attack is successful. */
	stance?: Stance[];
	/** attack: spaces in front of the attacker that are hit. */
	distance?: number[];
	/** attack: stance the attacker switches to after a successful hit. */
	switchStanceTo?: Stance;
}

export interface CardDef {
	id: CardId;
	kind: "movement" | "attack";
	/** true for the 3 orange special-attack cards (used once, then discarded). */
	special?: boolean;
	/**
	 * Faces of the card.
	 * Movement cards have two: [0] = top, [1] = bottom.
	 * Attack cards have a single face used regardless of side.
	 */
	faces: CardEffect[];
}

/** A card placed face-down (or revealed) into one of a player's two slots. */
export interface PlacedCard {
	cardId: CardId;
	/** Chosen face — only meaningful for movement cards. */
	side: Side | null;
	revealed: boolean;
}

export interface PlayerState {
	hand: CardId[];
	placed: Record<Slot, PlacedCard | null>;
	/** Card set aside last round, coming back to hand at the next end-of-round. */
	setAside: CardId | null;
	/** Special cards already used this game (out of play). */
	discarded: CardId[];
	/** Battlefield space, 0..4. Red starts at 0, Blue at 4. */
	space: number;
	stance: Stance;
	damage: 0 | 1 | 2;
}

export type TurnPhase =
	| "place" // Both players placing their 2 cards (each guarded by its own `confirmed` flag)
	| "ready" // Both confirmed, waiting to reveal first action
	| "reveal-first" // First action revealed & resolved
	| "reveal-second" // Second action revealed & resolved
	| "round-end" // Round resolved, ready to start the next one
	| "game-over";

/** Per-player outcome of a single resolved action, for UI feedback. */
export interface PlayerActionOutcome {
	moved: boolean;
	changedStance: boolean;
	/** This player landed a successful, uncancelled hit on the opponent. */
	hit: boolean;
	/** This player's attack was a feint (wrong stance / out of range). */
	feint: boolean;
	/** Feint specifically because the attacker wasn't in one of the card's stances (vs out of range). */
	wrongStance: boolean;
	/** This player's Counterattack cancelled the opponent's hit and dealt damage. */
	countered: boolean;
	/** A Kesa/Zan-Tetsu auto-switch fired: this player attacked in-stance, THEN flipped stance. */
	switchedStance: boolean;
}

/**
 * Relative ordering of an action's movement step, for staged animation. The engine resolves an
 * action atomically, but the rulebook orders movement by priority (Heaven first, then Charge >
 * Approach/Retreat > Change-Stance) before the simultaneous attacks; this lets the renderer play
 * those beats in sequence. Equal priority → "simultaneous" (both move at once).
 */
export interface ActionMovement {
	/** Movement priority of each side (higher resolves/animates first; 0 = no movement-tier card). */
	red: number;
	blue: number;
	order: "red-first" | "blue-first" | "simultaneous";
}

export interface ActionResolution {
	slot: Slot;
	red: PlayerActionOutcome;
	blue: PlayerActionOutcome;
	/** Movement ordering (by priority) so animation can stage the beats before the attack. */
	movement: ActionMovement;
	/** Both attacks were successful and cancelled each other. */
	clash: boolean;
}

export interface GameState {
	red: PlayerState;
	blue: PlayerState;
	/** Kept for compatibility; both clients pin it to "red" once placement is over. Perspective is a
	 *  view concern (viewerTeam), NOT this field. */
	current: Team;
	phase: TurnPhase;
	/** Whether each team has locked in its 2 cards this round. Both true → phase advances to "ready". */
	confirmed: Record<Team, boolean>;
	round: number;
	winner: Team | null;
	lastResolution: ActionResolution | null;
}

/**
 * Engine actions. The placement actions carry an explicit `team` so both players can place
 * simultaneously (multiplayer) or in turn on one device (pass & play) through the same reducer.
 */
export type GameAction =
	| { type: "PLACE_CARD"; team: Team; slot: Slot; cardId: CardId; side?: Side | null }
	| { type: "UNPLACE_CARD"; team: Team; slot: Slot }
	| { type: "CONFIRM_SELECTION"; team: Team }
	| { type: "REVEAL_FIRST" }
	| { type: "REVEAL_SECOND" }
	| { type: "END_ROUND" }
	| { type: "RESET_GAME" };

/**
 * UI-facing actions: views dispatch these WITHOUT a team — the networked dispatch (GameProvider)
 * injects the local/active team before it reaches the reducer.
 */
export type UIGameAction =
	| { type: "PLACE_CARD"; slot: Slot; cardId: CardId; side?: Side | null }
	| { type: "UNPLACE_CARD"; slot: Slot }
	| { type: "CONFIRM_SELECTION" }
	| { type: "REVEAL_FIRST" }
	| { type: "REVEAL_SECOND" }
	| { type: "END_ROUND" }
	| { type: "RESET_GAME" };
