import { useEffect } from "react";
import { duelIntro } from "../state/duelIntro";

/**
 * Schedules the duel's opening beats once the samurai start standing: the HUD `hudDelay` s after the
 * last one is up (`standSeconds` = its whole stand-up from the `standing` flip), the first turn
 * `turnDelay` s after the HUD. Timers only ever ADVANCE the stage, so a re-render that re-schedules
 * them never replays a beat.
 */
export const useDuelIntroDriver = (standing: boolean, standSeconds: number, hudDelay: number, turnDelay: number) => {
	useEffect(() => {
		if (!standing) return;
		const hudAt = (standSeconds + hudDelay) * 1000;
		const hud = setTimeout(() => duelIntro.advance("hud"), hudAt);
		const turn = setTimeout(() => duelIntro.advance("turn"), hudAt + turnDelay * 1000);
		return () => {
			clearTimeout(hud);
			clearTimeout(turn);
		};
	}, [standing, standSeconds, hudDelay, turnDelay]);
};
