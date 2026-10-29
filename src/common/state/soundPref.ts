import { useSyncExternalStore } from "react";

/**
 * The player's sound switch (lobby toggle): one master on/off for the SFX (audio.ts) AND the music
 * (music.ts), on top of their Leva debug mutes. Persisted in localStorage so it survives a reload;
 * storage can be unavailable (private mode / blocked site data), so every access is guarded.
 */
const STORAGE_KEY = "kiri-ai:sound";

const read = (): boolean => {
	try {
		return localStorage.getItem(STORAGE_KEY) !== "off";
	} catch {
		return true;
	}
};

let on = read();
const listeners = new Set<() => void>();

export const soundPref = {
	subscribe: (listener: () => void) => {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	},
	isOn: (): boolean => on,
	set: (next: boolean) => {
		if (on === next) return;
		on = next;
		try {
			localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
		} catch {
			// not persisted — the switch still works for this session
		}
		listeners.forEach((l) => l());
	},
};

export const useSoundOn = (): boolean => useSyncExternalStore(soundPref.subscribe, soundPref.isOn);
