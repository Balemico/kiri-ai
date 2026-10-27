import { useSyncExternalStore } from "react";

/**
 * The duel's opening beats, shared between the DOM HUD and the Canvas (where context can't reach):
 *   lying → the paper samurai lie flat, no HUD, no hand;
 *   hud   → both samurai have stood up, the HUD animates in;
 *   turn  → the first turn begins (turn highlight, pawn marker, the hand rises).
 * Only ever moves FORWARD during a duel (a re-scheduled timer can't replay a beat); `reset` on leaving.
 * Driven by Battlefield (it owns the stand-up timing) via `useDuelIntroDriver`.
 */
export type DuelIntroStage = "lying" | "hud" | "turn";

const ORDER: Record<DuelIntroStage, number> = { lying: 0, hud: 1, turn: 2 };

let stage: DuelIntroStage = "lying";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const duelIntro = {
	subscribe: (listener: () => void) => {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	},
	stage: (): DuelIntroStage => stage,
	/** Advance to `next` (never back). */
	advance: (next: DuelIntroStage) => {
		if (ORDER[next] <= ORDER[stage]) return;
		stage = next;
		emit();
	},
	reset: () => {
		if (stage === "lying") return;
		stage = "lying";
		emit();
	},
};

export const useDuelIntroStage = (): DuelIntroStage => useSyncExternalStore(duelIntro.subscribe, duelIntro.stage);

/** True once the beat `at` has been reached. */
export const useDuelIntroReached = (at: DuelIntroStage): boolean => ORDER[useDuelIntroStage()] >= ORDER[at];
