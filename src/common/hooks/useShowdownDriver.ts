import { useEffect } from "react";
import { useGame } from "../state/useGame";
import { duelMusic } from "../state/duelMusic";
import { useLagged } from "./useLagged";
import { useGameHudControls } from "./useGameHudControls";

/**
 * Flags the showdown (both players on their last life) for the music. Lagged by `hitLagMs` like the
 * HUD life seals, so the tenser track comes in as the second seal breaks, not at the card reveal.
 */
export const useShowdownDriver = () => {
	const { state } = useGame();
	const { hitLagMs } = useGameHudControls();
	const lastLife = state.red.damage === 1 && state.blue.damage === 1;
	const showdown = useLagged(lastLife, hitLagMs);
	useEffect(() => {
		if (showdown) duelMusic.setShowdown(true);
	}, [showdown]);
};
