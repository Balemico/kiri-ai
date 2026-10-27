import type { GameState, Team } from "../game";

/**
 * Pass & play hand-over state, shared between HandoffVeil (DOM) and the HUD — also from inside the
 * Canvas, where a component's own state can't reach. The turn that needs a hand-over is a pure key
 * (`handoffTurnKey`); the only stored value is the key the incoming player tapped away. A hand-over
 * is pending while its key exists and isn't the dismissed one — derived synchronously, so the HUD
 * never shows the next team's highlight for even one render before the veil is confirmed.
 */

/** `round-team` of a placing turn that needs the device to change hands, or null (online, round 1 red, not placing). */
export const handoffTurnKey = (state: GameState, local: boolean, viewerTeam: Team): string | null => {
	const placing = state.phase === "place" && !state.confirmed[viewerTeam];
	const opening = state.round === 1 && viewerTeam === "red";
	return local && placing && !opening ? `${state.round}-${viewerTeam}` : null;
};

let dismissed: string | null = null;
const listeners = new Set<() => void>();

export const handoffSignal = {
	subscribe: (listener: () => void) => {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	},
	dismissed: (): string | null => dismissed,
	dismiss: (key: string | null) => {
		if (dismissed === key) return;
		dismissed = key;
		listeners.forEach((l) => l());
	},
};
