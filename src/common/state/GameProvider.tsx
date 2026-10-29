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
	/** Local rematch: called on RESET_GAME instead of resetting in place, so the app can replay the
	 *  ink-veil entrance and remount a fresh duel under it (no pieces snapping back on screen). */
	onRematch?: () => void;
	/** Leaving the duel: called instead of `session.leave()`, so the app can slash the ink veil in
	 *  first and swap back to the lobby under it. */
	onLeave?: () => void;
}

/**
 * Wraps the pure engine with a networked dispatch. Views dispatch team-less `UIGameAction`s; here we
 *  - inject the local/active team into placement + confirm actions,
 *  - keep placement local (pass & play: hand the device over; online: relay only on confirm),
 *  - let the host drive + relay the reveal sequence (the guest applies what it receives).
 * The reducer itself stays pure and unaware of the network.
 */
export const GameProvider = ({ children, config, onRematch, onLeave }: GameProviderProps) => {
	const [state, rawDispatch] = useReducer(reducer, config, createInitialState);
	const session = useSession();
	const { mode, viewerTeam, isHost, bindReceiver } = session;
	const sessionLeave = session.leave;
	const leave = useCallback(() => (onLeave ? onLeave() : sessionLeave()), [onLeave, sessionLeave]);

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
					if (mode === "local") {
						// A new duel opens on red's turn, like the first one.
						session.resetActiveTeam();
						if (onRematch) onRematch();
						else rawDispatch(action);
					} else leave();
					return;
			}
		},
		[state, mode, viewerTeam, isHost, session, rawDispatch, onRematch, leave]
	);

	const value = useMemo(() => ({ state, dispatch, leave }), [state, dispatch, leave]);
	return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
