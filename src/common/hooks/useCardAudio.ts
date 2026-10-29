import { useEffect, useRef } from "react";
import { useGame } from "../state";
import { playSound } from "../audio";

/**
 * Plays the card-place snap whenever a slot goes from empty to filled — for either team, so online the
 * opponent's placements are heard too. Clearing a slot (unplace, end of round, reset) stays silent.
 * The deal (hand cascade) and pick (card lifted) sounds live where those gestures happen: HandCard / Hand.
 */
export const useCardAudio = (): void => {
	const { state } = useGame();
	const filled = [state.red.placed.first, state.red.placed.second, state.blue.placed.first, state.blue.placed.second].map(Boolean);
	const sig = filled.map((f) => (f ? 1 : 0)).join("");
	const prev = useRef(sig);

	useEffect(() => {
		const before = prev.current;
		prev.current = sig;
		if ([...sig].some((c, i) => c === "1" && before[i] === "0")) playSound("cardPlace");
	}, [sig]);
};
