import { useReducer, useMemo, useCallback, useEffect, type ReactNode } from "react";
import { reducer, createInitialState, type EngineConfig, type UIGameAction } from "../game";
// Import via subpaths (not the "../net" barrel) so state → net doesn't form an import cycle with the
// net components that read game state.
import { useSession } from "../net/useSession";
import { placementsOf } from "../net/protocol";
import { GameContext } from "./GameContext";
import { canConfirm } from "./selectors";

export interface GameProviderProps {
	children: ReactNode;
	config?: EngineConfig;
}

/**
 * Wraps the pure engine with a networked dispatch. Views dispatch team-less `UIGameAction`s; here we
 *  - inject the local/active team into placement + confirm actions,
 *  - keep placement local (pass & play: hand the device over; online: relay only on confirm),
 *  - let the host drive + relay the reveal sequence (the guest applies what it receives).
 * The reducer itself stays pure and unaware of the network.
 */
export const GameProvider = ({ children, config }: GameProviderProps) => {
	const [state, rawDispatch] = useReducer(reducer, config, createInitialState);
	const session = useSession();
	const { mode, viewerTeam, isHost, bindReceiver } = session;

	// Let incoming P2P messages apply to this engine instance.
	useEffect(() => bindReceiver(rawDispatch), [bindReceiver, rawDispatch]);

	const dispatch = useCallback(
		(action: UIGameAction) => {
			switch (action.type) {
				case "PLACE_CARD":
				case "UNPLACE_CARD":
					// Local edit only — never relayed (keeps the opponent's cards hidden until confirm).
					rawDispatch({ ...action, team: viewerTeam });
					return;
				case "CONFIRM_SELECTION": {
					if (!canConfirm(state, viewerTeam)) return;
					rawDispatch({ type: "CONFIRM_SELECTION", team: viewerTeam });
					if (mode === "local") session.advanceActiveTeam();
					else session.sendCommit(viewerTeam, placementsOf(state[viewerTeam]));
					return;
				}
				case "REVEAL_FIRST":
				case "REVEAL_SECOND":
				case "END_ROUND":
					// The reveal sequence is single-driver: locally always, online only on the host (which
					// relays it). The guest advances purely via the relayed actions it receives.
					if (mode === "local") {
						rawDispatch(action);
						if (action.type === "END_ROUND") session.resetActiveTeam();
					} else if (isHost) {
						rawDispatch(action);
						session.sendPhase(action);
					}
					return;
				case "RESET_GAME":
					// Online has no shared reshuffle in v1 — a rematch drops both back to the menu.
					if (mode === "local") rawDispatch(action);
					else session.leave();
					return;
			}
		},
		[state, mode, viewerTeam, isHost, session, rawDispatch]
	);

	const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);
	return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
