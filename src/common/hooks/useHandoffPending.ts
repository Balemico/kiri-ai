import { useSyncExternalStore } from "react";
import { useGame } from "../state";
import { handoffSignal, handoffTurnKey } from "../state/handoffSignal";
import { useSession } from "../net";

/**
 * Pass & play: true from the moment the device must change hands until the incoming player taps the
 * HandoffVeil away. Derived synchronously from the engine state + the dismissed key (an external
 * store), so it also works inside the Canvas.
 */
export const useHandoffPending = (): boolean => {
	const { state } = useGame();
	const { mode, viewerTeam } = useSession();
	const dismissed = useSyncExternalStore(handoffSignal.subscribe, handoffSignal.dismissed);
	const turnKey = handoffTurnKey(state, mode === "local", viewerTeam);
	return turnKey !== null && turnKey !== dismissed;
};
