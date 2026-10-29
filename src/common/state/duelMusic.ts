import { useSyncExternalStore } from "react";

/**
 * The duel's musical mood, read OUTSIDE the GameProvider (AppRoot owns the music): `showdown` flips
 * once both players are down to their last life — the battle track gives way to a tenser one. Driven
 * by `useShowdownDriver` in Scene (lagged like the HUD seals, so the music turns as the blade lands);
 * `reset` on leaving the duel (Scene unmount), so a rematch opens on a battle track again.
 */
let showdown = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const duelMusic = {
	subscribe: (listener: () => void) => {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	},
	showdown: (): boolean => showdown,
	setShowdown: (value: boolean) => {
		if (showdown === value) return;
		showdown = value;
		emit();
	},
	reset: () => duelMusic.setShowdown(false),
};

/** True once both players have a single life left. */
export const useShowdown = (): boolean => useSyncExternalStore(duelMusic.subscribe, duelMusic.showdown);
