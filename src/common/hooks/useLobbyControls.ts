import { useControls } from "leva";
import { LOBBY } from "../layout";

export interface LobbyControls {
	/** Inset of the tree's mass centre from the visible LEFT edge (negative = bleeds off). */
	treeEdge: number;
	/** Inset of the tree's painted base from the visible BOTTOM edge (negative = bleeds below). */
	treeBottom: number;
	treeScale: number;
	leafCount: number;
	windStrength: number;
	drift: number;
	fallSpeed: number;
	mistOpacity: number;
	mistSpeed: number;
	/** Portrait: horizon as a fraction of the visible height from the top. */
	portraitHorizon: number;
	/** Portrait: panorama size multiplier vs landscape. */
	portraitScale: number;
}

/** Live-tunable lobby-panorama knobs, in their own collapsed Leva folder (defaults: LOBBY). */
export const useLobbyControls = (): LobbyControls =>
	useControls(
		"Lobby",
		{
			treeEdge: { value: LOBBY.treeEdge, min: -1.5, max: 3, step: 0.05 },
			treeBottom: { value: LOBBY.treeBottom, min: -1.5, max: 1.5, step: 0.05 },
			treeScale: { value: LOBBY.treeScale, min: 1, max: 3.2, step: 0.05 },
			leafCount: { value: LOBBY.leaves.count, min: 0, max: 80, step: 1 },
			windStrength: { value: LOBBY.leaves.windStrength, min: 0, max: 1.5, step: 0.05 },
			drift: { value: LOBBY.leaves.drift, min: 0, max: 1, step: 0.02 },
			fallSpeed: { value: LOBBY.leaves.fallSpeed, min: 0.05, max: 0.8, step: 0.01 },
			mistOpacity: { value: LOBBY.mist.opacity, min: 0, max: 1, step: 0.02 },
			mistSpeed: { value: LOBBY.mist.speed, min: 0, max: 0.1, step: 0.002 },
			portraitHorizon: { value: LOBBY.portrait.horizonFraction, min: 0.2, max: 0.8, step: 0.01, label: "portrait horizon" },
			portraitScale: { value: LOBBY.portrait.panoramaScale, min: 1, max: 2.5, step: 0.05, label: "portrait scale" },
		},
		{ collapsed: true },
	);
