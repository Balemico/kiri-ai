import { useControls } from "leva";
import { PAWN } from "../layout";

export interface PawnControls {
	/** World height of the samurai sprite. */
	height: number;
	/** Vertical nudge of the feet relative to the board line. */
	yLift: number;
	/** Forward offset in front of the board line. */
	z: number;
}

/** Live-tunable pawn sprite size/placement, in its own collapsed Leva folder. */
export const usePawnControls = (): PawnControls =>
	useControls(
		"Pawn",
		{
			height: { value: PAWN.height, min: 0.2, max: 1.2, step: 0.01 },
			yLift: { value: PAWN.yLift, min: -0.3, max: 0.3, step: 0.01 },
			z: { value: PAWN.z, min: -0.5, max: 0.5, step: 0.01 },
		},
		{ collapsed: true },
	);
