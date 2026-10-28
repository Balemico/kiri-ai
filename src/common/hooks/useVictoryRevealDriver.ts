import { useEffect } from "react";
import { victoryReveal } from "../state/victoryReveal";

/**
 * Schedules the victory screen once the duel is `over`: `seconds` after game-over = the killing blow's
 * beat + the loser's fall + a short pause. The store only moves forward, so a re-render that
 * re-schedules the timer never replays it.
 */
export const useVictoryRevealDriver = (over: boolean, seconds: number) => {
	useEffect(() => {
		if (!over) return;
		const t = setTimeout(() => victoryReveal.show(), seconds * 1000);
		return () => clearTimeout(t);
	}, [over, seconds]);
};
