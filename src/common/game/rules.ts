import type {
	GameState,
	PlayerState,
	Slot,
	Stance,
	Team,
	ActionResolution,
	ActionMovement,
	PlayerActionOutcome,
	CardEffect,
} from "./types";
import { getEffect } from "./cards";

// --- Battlefield geometry ---------------------------------------------------

export const BOARD_SPACES = 5; // indices 0..4
export const RED_START = 0;
export const BLUE_START = 4;

const X_STEP = 0.75;
const X_ORIGIN = -1.5;

/** Map a board space index (0..4) to its world x coordinate. */
export const spaceToX = (space: number): number => X_ORIGIN + space * X_STEP;

const clampBoard = (space: number): number => Math.max(0, Math.min(BOARD_SPACES - 1, space));

const other = (team: Team): Team => (team === "red" ? "blue" : "red");

const flip = (stance: Stance): Stance => (stance === "heaven" ? "earth" : "heaven");

// --- Movement ---------------------------------------------------------------

interface MoveIntent {
	kind: "move" | "stance" | "none";
	/** Signed board delta (red toward opponent = +, blue toward opponent = -). */
	delta: number;
	priority: number;
}

/**
 * Movement priority (higher resolves first):
 *   Heaven-stance movement (+100) precedes Earth-stance movement,
 *   then by type: Charge (3) > Approach/Retreat (2) > Change-Stance (1).
 * Isolated here so the "Heaven moves first" interpretation is easy to tweak.
 */
const movementPriority = (effect: CardEffect, stance: Stance): number => {
	let typeRank: number;
	if (effect.kind === "change-stance") typeRank = 1;
	else typeRank = Math.abs(effect.amount ?? 0) >= 2 ? 3 : 2; // charge vs approach/retreat
	return (stance === "heaven" ? 100 : 0) + typeRank;
};

const intentFor = (team: Team, effect: CardEffect | undefined, stance: Stance): MoveIntent => {
	if (!effect) return { kind: "none", delta: 0, priority: 0 };
	if (effect.kind === "change-stance") {
		return { kind: "stance", delta: 0, priority: movementPriority(effect, stance) };
	}
	if (effect.kind === "movement") {
		const toward = effect.amount ?? 0;
		const delta = team === "red" ? toward : -toward;
		return { kind: "move", delta, priority: movementPriority(effect, stance) };
	}
	return { kind: "none", delta: 0, priority: 0 }; // attack / counter handled later
};

/** Move one player, clamping to the board and forbidding passing the opponent. */
const moveOne = (team: Team, pos: number, delta: number, oppPos: number): number => {
	let target = clampBoard(pos + delta);
	if (team === "red" && delta > 0 && target > oppPos) target = oppPos; // red can't pass blue
	if (team === "blue" && delta < 0 && target < oppPos) target = oppPos; // blue can't pass red
	return target;
};

/** Resolve both players' movement for an action. Returns updated spaces. */
const resolveMovement = (
	redPos: number,
	bluePos: number,
	red: MoveIntent,
	blue: MoveIntent
): { red: number; blue: number } => {
	const redMoves = red.kind === "move";
	const blueMoves = blue.kind === "move";

	if (!redMoves && !blueMoves) return { red: redPos, blue: bluePos };

	if (redMoves && !blueMoves) return { red: moveOne("red", redPos, red.delta, bluePos), blue: bluePos };
	if (blueMoves && !redMoves) return { red: redPos, blue: moveOne("blue", bluePos, blue.delta, redPos) };

	// Both move.
	if (red.priority !== blue.priority) {
		// Higher priority moves first, then the other from the updated positions.
		if (red.priority > blue.priority) {
			const r = moveOne("red", redPos, red.delta, bluePos);
			const b = moveOne("blue", bluePos, blue.delta, r);
			return { red: r, blue: b };
		} else {
			const b = moveOne("blue", bluePos, blue.delta, redPos);
			const r = moveOne("red", redPos, red.delta, b);
			return { red: r, blue: b };
		}
	}

	// Equal priority → simultaneous.
	const gap = bluePos - redPos;
	const converging = red.delta > 0 && blue.delta < 0;
	if (converging) {
		const closure = red.delta + -blue.delta;
		if (closure <= gap) {
			return { red: clampBoard(redPos + red.delta), blue: clampBoard(bluePos + blue.delta) };
		}
		// They meet: equal movement without passing → split the gap.
		const m = Math.floor(gap / 2);
		return { red: clampBoard(redPos + m), blue: clampBoard(bluePos - m) };
	}
	// Same-direction or diverging: apply both, keep red ≤ blue invariant.
	let r = clampBoard(redPos + red.delta);
	const b = clampBoard(bluePos + blue.delta);
	if (r > b) r = b;
	return { red: r, blue: b };
};

// --- Attacks ----------------------------------------------------------------

/** Does `attacker` (with attack `effect`) land a raw hit on `defender`? */
const isAttackHit = (
	team: Team,
	effect: CardEffect,
	attacker: PlayerState,
	defender: PlayerState
): boolean => {
	if (effect.kind !== "attack") return false;
	if (!effect.stance?.includes(attacker.stance)) return false; // wrong stance = feint
	const distances = effect.distance ?? [];
	return distances.some((d) => {
		const target = team === "red" ? attacker.space + d : attacker.space - d;
		return defender.space === target;
	});
};

// --- Action resolution ------------------------------------------------------

const emptyOutcome = (): PlayerActionOutcome => ({
	moved: false,
	changedStance: false,
	hit: false,
	feint: false,
	wrongStance: false,
	countered: false,
	switchedStance: false,
});

/** True when an attack card is played from a stance it doesn't allow (so it can never hit). */
const isWrongStance = (effect: CardEffect | undefined, stance: Stance): boolean =>
	effect?.kind === "attack" && !effect.stance?.includes(stance);

export interface ResolveResult {
	red: PlayerState;
	blue: PlayerState;
	resolution: ActionResolution;
	winner: Team | null;
}

/**
 * Resolve a single action step (both players' card in `slot`):
 * movement first (by priority), then simultaneous attacks/counters and damage.
 */
export const resolveAction = (state: GameState, slot: Slot): ResolveResult => {
	const red: PlayerState = { ...state.red };
	const blue: PlayerState = { ...state.blue };

	const redPlaced = red.placed[slot];
	const bluePlaced = blue.placed[slot];
	const redEffect = redPlaced ? getEffect(redPlaced.cardId, redPlaced.side) : undefined;
	const blueEffect = bluePlaced ? getEffect(bluePlaced.cardId, bluePlaced.side) : undefined;

	const redOut = emptyOutcome();
	const blueOut = emptyOutcome();

	// 1) Movement (uses stance *before* any change-stance flips).
	const redIntent = intentFor("red", redEffect, red.stance);
	const blueIntent = intentFor("blue", blueEffect, blue.stance);
	const moved = resolveMovement(red.space, blue.space, redIntent, blueIntent);
	redOut.moved = moved.red !== red.space;
	blueOut.moved = moved.blue !== blue.space;
	red.space = moved.red;
	blue.space = moved.blue;

	// Change-stance movement card flips the stance.
	if (redIntent.kind === "stance") {
		red.stance = flip(red.stance);
		redOut.changedStance = true;
	}
	if (blueIntent.kind === "stance") {
		blue.stance = flip(blue.stance);
		blueOut.changedStance = true;
	}

	// Movement ordering for staged animation: a movement-tier card (move or change-stance) carries a
	// priority; the higher one animates first, equal priorities animate together.
	const redMoves = redIntent.kind !== "none";
	const blueMoves = blueIntent.kind !== "none";
	let order: ActionMovement["order"] = "simultaneous";
	if (redMoves && blueMoves) {
		if (redIntent.priority > blueIntent.priority) order = "red-first";
		else if (blueIntent.priority > redIntent.priority) order = "blue-first";
	}
	const movement: ActionMovement = {
		red: redMoves ? redIntent.priority : 0,
		blue: blueMoves ? blueIntent.priority : 0,
		order,
	};

	// 2) Attacks & counters (simultaneous, using updated positions/stances).
	let redHits = redEffect ? isAttackHit("red", redEffect, red, blue) : false;
	let blueHits = blueEffect ? isAttackHit("blue", blueEffect, blue, red) : false;
	const redCounter = redEffect?.kind === "counter";
	const blueCounter = blueEffect?.kind === "counter";

	redOut.feint = redEffect?.kind === "attack" && !redHits;
	blueOut.feint = blueEffect?.kind === "attack" && !blueHits;
	redOut.wrongStance = isWrongStance(redEffect, red.stance);
	blueOut.wrongStance = isWrongStance(blueEffect, blue.stance);

	let redDamaged = false;
	let blueDamaged = false;
	let clash = false;

	// Counters cancel the opponent's successful attack and deal damage instead.
	if (redCounter && blueHits) {
		blueDamaged = true;
		blueHits = false;
	}
	if (blueCounter && redHits) {
		redDamaged = true;
		redHits = false;
	}

	if (redHits && blueHits) {
		clash = true; // swords meet, no damage
	} else {
		if (redHits) blueDamaged = true;
		if (blueHits) redDamaged = true;
	}

	redOut.countered = redCounter && blueDamaged;
	blueOut.countered = blueCounter && redDamaged;
	redOut.hit = redHits || redOut.countered;
	blueOut.hit = blueHits || blueOut.countered;

	// Kesa/Zan-Tetsu auto-switch stance after attacking in their valid stance (the hit above already
	// resolved in the pre-switch stance). Record it so the renderer can stage the flip after the strike.
	if (redEffect?.switchStanceTo && redEffect.stance?.includes(red.stance)) {
		red.stance = redEffect.switchStanceTo;
		redOut.switchedStance = true;
	}
	if (blueEffect?.switchStanceTo && blueEffect.stance?.includes(blue.stance)) {
		blue.stance = blueEffect.switchStanceTo;
		blueOut.switchedStance = true;
	}

	// 3) Apply damage.
	if (redDamaged) red.damage = Math.min(2, red.damage + 1) as PlayerState["damage"];
	if (blueDamaged) blue.damage = Math.min(2, blue.damage + 1) as PlayerState["damage"];

	// A clash deals no damage, so a true double-KO is not reachable here; if both
	// are somehow defeated, treat it as a draw resolved in red's favour.
	let winner: Team | null = null;
	if (blue.damage >= 2) winner = "red";
	else if (red.damage >= 2) winner = "blue";

	const resolution: ActionResolution = { slot, red: redOut, blue: blueOut, movement, clash };
	return { red, blue, resolution, winner };
};

export { other };
