import { useSyncExternalStore } from "react";

export type Lang = "it" | "en";

/**
 * The player's language (lobby ITA | ENG switch, next to the sound one). Persisted in localStorage;
 * first visit follows the browser (Italian browsers → "it", anything else → "en"). Storage can be
 * unavailable (private mode / blocked site data), so every access is guarded.
 */
const STORAGE_KEY = "kiri-ai:lang";

const read = (): Lang => {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === "it" || stored === "en") return stored;
	} catch {
		// fall through to the browser language
	}
	return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("it") ? "it" : "en";
};

const applyDocumentLang = (lang: Lang) => {
	if (typeof document !== "undefined") document.documentElement.lang = lang;
};

let lang = read();
applyDocumentLang(lang);
const listeners = new Set<() => void>();

export const langPref = {
	subscribe: (listener: () => void) => {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	},
	get: (): Lang => lang,
	set: (next: Lang) => {
		if (lang === next) return;
		lang = next;
		applyDocumentLang(next);
		try {
			localStorage.setItem(STORAGE_KEY, next);
		} catch {
			// not persisted — the switch still works for this session
		}
		listeners.forEach((l) => l());
	},
};

export const useLang = (): Lang => useSyncExternalStore(langPref.subscribe, langPref.get);
