import { useControls } from "leva";
import { RESOLUTION, type ResolutionConfig } from "../layout";

export type ResolutionControls = ResolutionConfig;

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
