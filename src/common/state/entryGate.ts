import { useSyncExternalStore } from "react";

/**
 * The lobby's entry gate (logo + ENTRA + audio switch), shown once per app load before the entry
 * cinematic. Browsers only allow sound after a real gesture, so the ENTRA tap is that gesture: it
 * starts the music, unlocks the SFX and releases the cinematic in the same tap. Module store, so
 * AppRoot (music) and Lobby (the gate itself) read the same flag; coming back from a duel never
 * shows it again.
 */
let entered = false;
const listeners = new Set<() => void>();

export const entryGate = {
	subscribe: (listener: () => void) => {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	},
	isEntered: (): boolean => entered,
	enter: () => {
		if (entered) return;
		entered = true;
		listeners.forEach((l) => l());
	},
};

export const useEntered = (): boolean => useSyncExternalStore(entryGate.subscribe, entryGate.isEntered);
