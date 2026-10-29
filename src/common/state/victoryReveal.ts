import { useSyncExternalStore } from "react";

/**
 * The duel's closing beat ("zanshin"), shared between the Canvas (where the defeated samurai falls)
 * and the DOM (the victory screen + its actions). Forward-only stages:
 *   playing → cleared (the loser starts to fall: HUD, callouts and markers step aside)
 *           → shown   (the loser lies flat, a beat of silence has passed: the victory screen comes in).
 * Driven by Battlefield (it owns the fall timing); `reset` on leaving the duel (Scene unmount), so a
 * rematch starts from the top.
 */
type Stage = 0 | 1 | 2;
let stage: Stage = 0;
const listeners = new Set<() => void>();
const advance = (to: Stage) => {
	if (stage >= to) return;
	stage = to;
	listeners.forEach((l) => l());
};

export const victoryReveal = {
	subscribe: (listener: () => void) => {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	},
	cleared: (): boolean => stage >= 1,
	shown: (): boolean => stage >= 2,
	clear: () => advance(1),
	show: () => advance(2),
	reset: () => {
		if (stage === 0) return;
		stage = 0;
		listeners.forEach((l) => l());
	},
};

/** True once the loser starts to fall: everything but the stage and the two figures steps aside. */
export const useVictoryCleared = (): boolean => useSyncExternalStore(victoryReveal.subscribe, victoryReveal.cleared);

/** True once the defeated samurai has fallen and the victory screen may appear. */
export const useVictoryShown = (): boolean => useSyncExternalStore(victoryReveal.subscribe, victoryReveal.shown);
