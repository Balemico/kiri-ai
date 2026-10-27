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
	edgeOffsetX: number;
	edgeOffsetY: number;
	edgeOpacity: number;
	shadowOpacity: number;
	shadowWidth: number;
	shadowHeight: number;
}

/** Live-tunable paper cut-out look + stand-up entrance, in its own collapsed Leva folder. "Play
 *  stand-up" lays both samurai back down and replays the spring-up. */
export const usePaperCutoutControls = (onReplay: () => void): PaperCutoutControls =>
	useControls(
		"Paper Cutout",
		{
			"play stand-up": button(() => onReplay()),
			lieAngle: { value: PAPER_CUTOUT.lieAngle, min: -1.57, max: 0, step: 0.01, label: "lie angle" },
			standDur: { value: PAPER_CUTOUT.standDur, min: 0.3, max: 6, step: 0.05, label: "stand (s)" },
			liftShare: { value: PAPER_CUTOUT.liftShare, min: 0.1, max: 0.9, step: 0.01, label: "lift share" },
			overshoot: { value: PAPER_CUTOUT.overshoot, min: 0, max: 0.3, step: 0.005, label: "overshoot (rad)" },
			revealDelay: { value: PAPER_CUTOUT.revealDelay, min: 0, max: 2, step: 0.05, label: "after veil opens (s)" },
			stagger: { value: PAPER_CUTOUT.stagger, min: 0, max: 3, step: 0.05 },
			rimScale: { value: PAPER_CUTOUT.rimScale, min: 1, max: 1.1, step: 0.005, label: "paper rim" },
			rimColor: { value: PAPER_CUTOUT.rimColor, label: "rim colour" },
			edgeOffsetX: { value: PAPER_CUTOUT.edgeOffsetX, min: -0.05, max: 0.05, step: 0.001, label: "edge x" },
			edgeOffsetY: { value: PAPER_CUTOUT.edgeOffsetY, min: -0.05, max: 0.05, step: 0.001, label: "edge y" },
			edgeOpacity: { value: PAPER_CUTOUT.edgeOpacity, min: 0, max: 1, step: 0.01, label: "edge opacity" },
			shadowOpacity: { value: PAPER_CUTOUT.shadowOpacity, min: 0, max: 1, step: 0.01, label: "shadow" },
			shadowWidth: { value: PAPER_CUTOUT.shadowWidth, min: 0.1, max: 1.5, step: 0.01, label: "shadow width" },
			shadowHeight: { value: PAPER_CUTOUT.shadowHeight, min: 0.01, max: 0.4, step: 0.005, label: "shadow height" },
		},
		{ collapsed: true },
	);
