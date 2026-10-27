import { useControls } from "leva";
import { RESOLUTION, type ResolutionConfig } from "../layout";
import type { ActionResolution, Team } from "../game";

export type ResolutionControls = ResolutionConfig;

/** Per-pawn movement delays for a resolution: the lower-priority mover waits `moveStagger`. */
export const moveDelays = (resolution: ActionResolution, c: ResolutionConfig): Record<Team, number> => {
	const order = resolution.movement.order;
	return { red: order === "blue-first" ? c.moveStagger : 0, blue: order === "red-first" ? c.moveStagger : 0 };
};

/** Seconds from the reveal to the strike landing: movement beats first, then `attackGap`. */
export const attackBeat = (resolution: ActionResolution, c: ResolutionConfig): number => {
	const moved = resolution.red.moved || resolution.blue.moved;
	const d = moveDelays(resolution, c);
	return (moved ? Math.max(d.red, d.blue) + c.moveDur : 0) + c.attackGap;
};

/**
 * Live-tunable staging of an action's resolution, in its own collapsed Leva folder. The movement
 * priority beats play before the attack: the higher-priority pawn slides first, the lower-priority
 * one after `moveStagger`, then the attack lands `attackGap` after movement settles (equal priority
 * → both slide together). Defaults come from RESOLUTION in layout.ts.
 */
export const useResolutionControls = (): ResolutionControls =>
	useControls(
		"Resolution",
		{
			moveDur: { value: RESOLUTION.moveDur, min: 0.1, max: 2, step: 0.05 },
			moveStagger: { value: RESOLUTION.moveStagger, min: 0, max: 2, step: 0.05 },
			attackGap: { value: RESOLUTION.attackGap, min: 0, max: 1.5, step: 0.05 },
		},
		{ collapsed: true },
	);
