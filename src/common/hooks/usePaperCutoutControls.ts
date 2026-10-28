import { button, useControls } from "leva";
import { PAPER_CUTOUT } from "../layout";

export interface PaperCutoutControls {
	lieAngle: number;
	standDur: number;
	liftShare: number;
	overshoot: number;
	revealDelay: number;
	stagger: number;
	rimScale: number;
	rimColor: string;
	rimOffsetY: number;
	edgeOffsetX: number;
	edgeOffsetY: number;
	edgeOpacity: number;
	shadowOpacity: number;
	shadowWidth: number;
	shadowHeight: number;
	swayAngle: number;
	swayDur: number;
	/** The permanent sword cut on a struck figure: a thin triangular notch — fractions of its height (see pawnCut.ts). */
	cutHeight: number;
	/** Radians below horizontal: from above on the outer side, down into the body. */
	cutAngle: number;
	cutLength: number;
	cutWidth: number;
	cutRim: number;
	/** The killing blow widens the same notch this much. */
	cutDeath: number;
}

/** Live-tunable paper cut-out look + stand-up entrance, in its own collapsed Leva folder. "Play
 *  stand-up" lays both samurai back down and replays the spring-up; "play fall" previews the defeat
 *  fall (the stand-up in reverse) on blue, which then stands back up. */
export const usePaperCutoutControls = (onReplay: () => void, onFall: () => void): PaperCutoutControls =>
	useControls(
		"Paper Cutout",
		{
			"play stand-up": button(() => onReplay()),
			"play fall": button(() => onFall()),
			lieAngle: { value: PAPER_CUTOUT.lieAngle, min: -1.57, max: 0, step: 0.01, label: "lie angle" },
			standDur: { value: PAPER_CUTOUT.standDur, min: 0.3, max: 6, step: 0.05, label: "stand (s)" },
			liftShare: { value: PAPER_CUTOUT.liftShare, min: 0.1, max: 0.9, step: 0.01, label: "lift share" },
			overshoot: { value: PAPER_CUTOUT.overshoot, min: 0, max: 0.3, step: 0.005, label: "overshoot (rad)" },
			revealDelay: { value: PAPER_CUTOUT.revealDelay, min: 0, max: 2, step: 0.05, label: "after veil opens (s)" },
			stagger: { value: PAPER_CUTOUT.stagger, min: 0, max: 3, step: 0.05 },
			rimScale: { value: PAPER_CUTOUT.rimScale, min: 1, max: 1.1, step: 0.005, label: "paper rim" },
			rimColor: { value: PAPER_CUTOUT.rimColor, label: "rim colour" },
			rimOffsetY: { value: PAPER_CUTOUT.rimOffsetY, min: -0.05, max: 0.05, step: 0.001, label: "rim y" },
			edgeOffsetX: { value: PAPER_CUTOUT.edgeOffsetX, min: -0.05, max: 0.05, step: 0.001, label: "edge x" },
			edgeOffsetY: { value: PAPER_CUTOUT.edgeOffsetY, min: -0.05, max: 0.05, step: 0.001, label: "edge y" },
			edgeOpacity: { value: PAPER_CUTOUT.edgeOpacity, min: 0, max: 1, step: 0.01, label: "edge opacity" },
			shadowOpacity: { value: PAPER_CUTOUT.shadowOpacity, min: 0, max: 1, step: 0.01, label: "shadow" },
			shadowWidth: { value: PAPER_CUTOUT.shadowWidth, min: 0.1, max: 1.5, step: 0.01, label: "shadow width" },
			shadowHeight: { value: PAPER_CUTOUT.shadowHeight, min: 0.01, max: 0.4, step: 0.005, label: "shadow height" },
			swayAngle: { value: PAPER_CUTOUT.swayAngle, min: 0, max: 1, step: 0.01, label: "hit sway (rad)" },
			swayDur: { value: PAPER_CUTOUT.swayDur, min: 0.2, max: 3, step: 0.05, label: "hit sway (s)" },
			cutHeight: { value: PAPER_CUTOUT.cutHeight, min: 0.1, max: 0.9, step: 0.01, label: "cut height" },
			cutAngle: { value: PAPER_CUTOUT.cutAngle, min: 0, max: 1.5, step: 0.01, label: "cut angle (rad)" },
			cutLength: { value: PAPER_CUTOUT.cutLength, min: 0.1, max: 1.2, step: 0.01, label: "cut length" },
			cutWidth: { value: PAPER_CUTOUT.cutWidth, min: 0.005, max: 0.25, step: 0.002, label: "cut width" },
			cutRim: { value: PAPER_CUTOUT.cutRim, min: 0, max: 0.05, step: 0.001, label: "cut rim" },
			cutDeath: { value: PAPER_CUTOUT.cutDeath, min: 1, max: 4, step: 0.05, label: "cut on death ×" },
		},
		{ collapsed: true },
	);
