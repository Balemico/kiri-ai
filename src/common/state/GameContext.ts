import { createContext } from "react";
import type { Dispatch } from "react";
import type { GameState, UIGameAction } from "../game";

export interface GameContextValue {
	state: GameState;
	/** Views dispatch team-less actions; GameProvider injects the team + handles the network relay. */
	dispatch: Dispatch<UIGameAction>;
	/** Back to the lobby — under the ink veil when the app provides one (`onLeave`), else at once. */
	leave: () => void;
}

export const GameContext = createContext<GameContextValue | undefined>(undefined);
