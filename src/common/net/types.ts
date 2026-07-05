import type { Dispatch } from "react";
import type { CardId, GameAction, Team } from "../game";
import type { Placement } from "./protocol";

/** Local pass & play on one device, or online P2P versus a remote opponent. */
export type Mode = "local" | "online";

/**
 * Where the session is in its lifecycle:
 *  - `menu`      choosing a mode / filling the lobby form (no game mounted).
 *  - `waiting`   online room joined, waiting for the opponent to connect.
 *  - `playing`   a game is mounted (local immediately; online once both peers are connected).
 *  - `peer-left` the opponent disconnected mid-game (v1 has no resume — back to the menu).
 */
export type SessionStatus = "menu" | "waiting" | "playing" | "peer-left";

export interface SessionValue {
	mode: Mode;
	status: SessionStatus;
	/** Online: this device's fixed colour. Local: null (perspective follows `activeTeam`). */
	localTeam: Team | null;
	/** Local pass & play: which colour is currently placing on the shared device. */
	activeTeam: Team;
	/** The colour this device renders from: `localTeam` online, `activeTeam` locally. */
	viewerTeam: Team;
	/** The host drives the reveal sequence (and relays it); the guest only applies what it receives. */
	isHost: boolean;
	roomKeyword: string | null;
	/** Shared special distribution, so both clients build an identical initial state. */
	specials: { red: CardId; blue: CardId } | null;

	// --- lobby actions ---
	startLocal: () => void;
	createRoom: (keyword: string, color: Team) => void;
	joinRoom: (keyword: string) => void;
	leave: () => void;

	// --- networked-dispatch plumbing (used by GameProvider) ---
	/** Register the engine's raw dispatch so incoming messages can be applied. Returns an unbind fn. */
	bindReceiver: (dispatch: Dispatch<GameAction>) => () => void;
	/** Broadcast this device's locked-in placement to the opponent. */
	sendCommit: (team: Team, placements: Placement[]) => void;
	/** Relay a shared phase action (host only). */
	sendPhase: (action: GameAction) => void;
	/** Local pass & play: hand the device to the other colour after a confirm. */
	advanceActiveTeam: () => void;
	/** Local pass & play: reset the placing colour at the start of a new round. */
	resetActiveTeam: () => void;
}
