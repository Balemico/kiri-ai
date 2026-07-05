import { useEffect } from "react";
import { useGame } from "../state";
import { useSession } from "../net/useSession";
import type { TurnPhase, UIGameAction } from "../game";

// Each self-resolving phase, the action that advances it, and how long to linger first (ms). The
// chain ends at a place phase (next round) or at game-over, neither of which has an entry here, so
// the timer stops. Reveals breathe for 3s; the post-round beat before the next turn is a touch longer.
const STEP: Partial<Record<TurnPhase, { action: UIGameAction; delayMs: number }>> = {
	ready: { action: { type: "REVEAL_FIRST" }, delayMs: 3000 },
	"reveal-first": { action: { type: "REVEAL_SECOND" }, delayMs: 3000 },
	"reveal-second": { action: { type: "END_ROUND" }, delayMs: 3500 },
};

/**
 * Drives the reveal phases on a timer: after each phase's delay the next action fires, flowing
 * ready → reveal-first → reveal-second → next round automatically. Stops as soon as the engine
 * reports a winner (phase "game-over"). Online, ONLY the host runs this (it relays each beat) so the
 * two clients don't both drive — the guest just applies the relayed actions.
 */
export const useAutoReveal = () => {
	const { state, dispatch } = useGame();
	const { mode, isHost } = useSession();
	const drive = mode === "local" || isHost;
	const phase = state.phase;

	useEffect(() => {
		if (!drive) return;
		const step = STEP[phase];
		if (!step) return;
		const id = setTimeout(() => dispatch(step.action), step.delayMs);
		return () => clearTimeout(id);
	}, [phase, dispatch, drive]);
};
