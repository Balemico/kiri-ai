import { useSyncExternalStore } from "react";

/**
 * Dev preview of a landed blow: the Leva "Game HUD → ▶ Play hit" button bumps the tick, and the hit
 * feedback (the edge wash in StrikeSplash, blue's life seal cracking in GameHud) replays it on BLUE,
 * struck by red, right away — whatever the game phase. A module store because the
 * button lives in a hook shared by DOM and Canvas components.
 */
let tick = 0;
const listeners = new Set<() => void>();

export const hitPreview = {
	subscribe: (listener: () => void) => {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	},
	tick: (): number => tick,
	play: () => {
		tick += 1;
		listeners.forEach((l) => l());
	},
};

/** 0 = never previewed; otherwise a fresh value per press (use it as the preview's key). */
export const useHitPreviewTick = (): number => useSyncExternalStore(hitPreview.subscribe, hitPreview.tick);
