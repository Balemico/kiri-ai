import { useSyncExternalStore } from "react";

/**
 * The in-duel menu (tap on the round ensō → "abandon the duel?"), shared between the HUD that opens
 * it, the dialog, and the action button (hidden while the dialog is up). `close` on leaving the duel
 * (Scene unmount), so the next duel starts with it shut.
 */
let open = false;
const listeners = new Set<() => void>();
const set = (next: boolean) => {
	if (open === next) return;
	open = next;
	listeners.forEach((l) => l());
};

export const quitMenu = {
	subscribe: (listener: () => void) => {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	},
	isOpen: (): boolean => open,
	open: () => set(true),
	close: () => set(false),
};

export const useQuitMenuOpen = (): boolean => useSyncExternalStore(quitMenu.subscribe, quitMenu.isOpen);
