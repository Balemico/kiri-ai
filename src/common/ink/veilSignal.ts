/**
 * "The veil has opened" — set by InkTransition once its drying passes `VEIL_OPEN_AT` (enough of the
 * duel is visible for an entrance to be SEEN), cleared when the next session starts. The duel reads
 * it (useSyncExternalStore) to time on-screen entrances such as the paper samurai standing up —
 * the drying is back-loaded (overlapping slashes uncover a spot only once ALL of them have dried),
 * so a fixed delay after "ready" would play them under the ink.
 */

/** Drying fraction (0..1) at which the veil counts as open. */
export const VEIL_OPEN_AT = 0.6;

let open = false;
const listeners = new Set<() => void>();

export const veilSignal = {
	subscribe: (listener: () => void) => {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	},
	isOpen: (): boolean => open,
	set: (value: boolean) => {
		if (open === value) return;
		open = value;
		listeners.forEach((l) => l());
	},
};
