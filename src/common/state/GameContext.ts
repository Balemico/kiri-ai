import { createContext } from "react";
import type { Dispatch } from "react";
import type { GameState, UIGameAction } from "../game";

export interface GameContextValue {
	state: GameState;
	/** Views dispatch team-less actions; GameProvider injects the team + handles the network relay. */
	dispatch: Dispatch<UIGameAction>;
}

export const GameContext = createContext<GameContextValue | undefined>(undefined);
