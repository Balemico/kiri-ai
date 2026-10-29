import { useEffect } from "react";
import { victoryReveal } from "../state/victoryReveal";

/**
 * Schedules the closing beat once the duel is `over` (seconds after game-over): `clearAt` = the loser
 * starts to fall (the interface steps aside), `showAt` = it lies flat + a beat of silence (the victory
 * screen comes in). The store only moves forward, so a re-render that re-schedules never replays it.
 */
export const useVictoryRevealDriver = (over: boolean, clearAt: number, showAt: number) => {
	useEffect(() => {
		if (!over) return;
		const clear = setTimeout(() => victoryReveal.clear(), clearAt * 1000);
		const show = setTimeout(() => victoryReveal.show(), showAt * 1000);
		return () => {
			clearTimeout(clear);
			clearTimeout(show);
		};
	}, [over, clearAt, showAt]);
};
