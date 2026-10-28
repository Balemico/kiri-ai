import { useSyncExternalStore } from "react";

/**
 * The duel's closing beat, shared between the Canvas (where the defeated samurai falls) and the DOM
 * (the victory screen + NUOVA PARTITA): the killing blow lands → the loser falls back flat → only THEN
 * `shown` flips and the victory screen comes in. Driven by Battlefield (it owns the fall timing);
 * `reset` on leaving the duel (Scene unmount), so a rematch starts hidden again.
 */
let shown = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const victoryReveal = {
	subscribe: (listener: () => void) => {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	},
	shown: (): boolean => shown,
	show: () => {
		if (shown) return;
		shown = true;
		emit();
	},
	reset: () => {
		if (!shown) return;
		shown = false;
		emit();
	},
};

/** True once the defeated samurai has fallen and the victory screen may appear. */
export const useVictoryShown = (): boolean => useSyncExternalStore(victoryReveal.subscribe, victoryReveal.shown);
