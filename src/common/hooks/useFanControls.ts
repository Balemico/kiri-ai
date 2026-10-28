import { DEFAULT_FAN, PORTRAIT_FAN_HEIGHT_OFFSET, PORTRAIT_FAN_MIN_STEP, type Orientation } from "../layout";
import { useOrientationFolder } from "./useOrientationFolder";

export interface FanControls {
	/** Horizontal distance between adjacent card centres (smaller → more overlap). */
	cardStep: number;
	/** Distance of the fan baseline from the bottom edge of the viewport. */
	fanHeightOffset: number;
	fanZ: number;
	curvature: number;
	baseScale: number;
	hoverScale: number;
	hoverLift: number;
	expansionStrength: number;
	/** Per-card delay of the cascade entry animation. */
	entryStagger: number;
	/** Delay (ms) before a hovered card is released — debounces edge flicker. */
	hoverReleaseMs: number;
	/** Portrait only: card height as a fraction of the viewport HEIGHT (proportional sizing). */
	cardScale: number;
	/** Portrait only: tightest step per unit of card scale before the cards shrink to fit the width. */
	minStep?: number;
}

// Shared fan params (used in both orientations).
const common = () => ({
	cardStep: { value: DEFAULT_FAN.cardStep, min: 0.05, max: 0.8, step: 0.01 },
	fanHeightOffset: { value: DEFAULT_FAN.fanHeightOffset, min: -1, max: 2, step: 0.05 },
	fanZ: { value: DEFAULT_FAN.fanZ, min: -1, max: 2, step: 0.05 },
	curvature: { value: DEFAULT_FAN.curvature, min: 0, max: 1, step: 0.01 },
	baseScale: { value: DEFAULT_FAN.baseScale, min: 0.5, max: 2, step: 0.05 },
	hoverScale: { value: DEFAULT_FAN.hoverScale, min: 1, max: 2, step: 0.05 },
	hoverLift: { value: DEFAULT_FAN.hoverLift, min: 0, max: 1, step: 0.05 },
	expansionStrength: { value: DEFAULT_FAN.expansionStrength, min: 0, max: 1, step: 0.05 },
	entryStagger: { value: DEFAULT_FAN.entryStagger, min: 0, max: 0.3, step: 0.005 },
	hoverReleaseMs: { value: DEFAULT_FAN.hoverReleaseMs, min: 0, max: 600, step: 10 },
});

/** Hand-fan parameters, in a "Hand Fan" folder with Landscape / Portrait sub-folders. Portrait adds
 *  `cardScale` (proportional sizing); landscape sizes from `baseScale`. */
export const useFanControls = (orientation: Orientation = "landscape"): FanControls =>
	useOrientationFolder<FanControls>(
		"Hand Fan",
		common(),
		{
			...common(),
			// Portrait sits the fan a touch higher off the bottom than landscape.
			fanHeightOffset: { value: PORTRAIT_FAN_HEIGHT_OFFSET, min: -1, max: 2, step: 0.05 },
			cardScale: { value: DEFAULT_FAN.cardScale, min: 0.05, max: 0.6, step: 0.01 },
			minStep: { value: PORTRAIT_FAN_MIN_STEP, min: 0.05, max: 0.6, step: 0.01, label: "min step" },
		},
		orientation,
	);
