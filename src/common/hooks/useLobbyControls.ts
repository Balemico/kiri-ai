import { useControls } from "leva";
import { LOBBY } from "../layout";

export interface LobbyControls {
	treeX: number;
	treeY: number;
	treeScale: number;
	leafCount: number;
	windStrength: number;
	drift: number;
	fallSpeed: number;
	mistOpacity: number;
	mistSpeed: number;
}

/** Live-tunable lobby-panorama knobs, in their own collapsed Leva folder (defaults: LOBBY). */
export const useLobbyControls = (): LobbyControls =>
	useControls(
		"Lobby",
		{
			treeX: { value: LOBBY.treeX, min: -4, max: 0, step: 0.05 },
			treeY: { value: LOBBY.treeY, min: -1.5, max: 1.5, step: 0.05 },
			treeScale: { value: LOBBY.treeScale, min: 1, max: 2.5, step: 0.05 },
			leafCount: { value: LOBBY.leaves.count, min: 0, max: 80, step: 1 },
			windStrength: { value: LOBBY.leaves.windStrength, min: 0, max: 1.5, step: 0.05 },
			drift: { value: LOBBY.leaves.drift, min: 0, max: 1, step: 0.02 },
			fallSpeed: { value: LOBBY.leaves.fallSpeed, min: 0.05, max: 0.8, step: 0.01 },
			mistOpacity: { value: LOBBY.mist.opacity, min: 0, max: 1, step: 0.02 },
			mistSpeed: { value: LOBBY.mist.speed, min: 0, max: 0.1, step: 0.002 },
		},
		{ collapsed: true },
	);
