import { PLAYED_CARDS, type PlayedCardConfig, type Orientation } from "../layout";
import { useOrientationFolder } from "./useOrientationFolder";

export type PlayedCardControls = PlayedCardConfig;

// Shared between both layouts: the resting/action z-planes, the toHand exit, and the hover raise.
const shared = () => ({
	restZ: { value: PLAYED_CARDS.restZ, min: -0.5, max: 1, step: 0.02 },
	actionZ: { value: PLAYED_CARDS.actionZ, min: -0.5, max: 1.5, step: 0.02 },
	toHandX: { value: PLAYED_CARDS.toHandX, min: 0, max: 2, step: 0.02 },
	toHandY: { value: PLAYED_CARDS.toHandY, min: -2, max: 1, step: 0.02 },
	toHandScale: { value: PLAYED_CARDS.toHandScale, min: 0.2, max: 1.2, step: 0.02 },
	raiseScale: { value: PLAYED_CARDS.raiseScale, min: 1, max: 1.6, step: 0.01 },
	raiseShift: { value: PLAYED_CARDS.raiseShift, min: 0, max: 1, step: 0.02 },
	raiseLift: { value: PLAYED_CARDS.raiseLift, min: 0, max: 1.5, step: 0.02 },
});

// Landscape: committed pair in the bottom corners, revealed card rises, set-aside laid flat by the line.
const landscape = () => ({
	restScale: { value: PLAYED_CARDS.restScale, min: 0.3, max: 1.4, step: 0.02 },
	restEdgeMargin: { value: PLAYED_CARDS.restEdgeMargin, min: 0, max: 2.5, step: 0.02 },
	restY: { value: PLAYED_CARDS.restY, min: -1, max: 2, step: 0.02 },
	restGap: { value: PLAYED_CARDS.restGap, min: 0, max: 1.5, step: 0.02 },
	restTopWidth: { value: PLAYED_CARDS.restTopWidth, min: 2, max: 8, step: 0.1 },
	restTopMargin: { value: PLAYED_CARDS.restTopMargin, min: 0, max: 2, step: 0.02 },
	actionScale: { value: PLAYED_CARDS.actionScale, min: 0.4, max: 2, step: 0.02 },
	actionTilt: { value: PLAYED_CARDS.actionTilt, min: 0, max: 1.57, step: 0.01 },
	actionEdgeMargin: { value: PLAYED_CARDS.actionEdgeMargin, min: 0, max: 2.5, step: 0.02 },
	actionY: { value: PLAYED_CARDS.actionY, min: -2, max: 2, step: 0.02 },
	setAsideScale: { value: PLAYED_CARDS.setAsideScale, min: 0.2, max: 1.0, step: 0.02 },
	setAsideRotZ: { value: PLAYED_CARDS.setAsideRotZ, min: -Math.PI, max: Math.PI, step: 0.01 },
	setAsideTilt: { value: PLAYED_CARDS.setAsideTilt, min: 0, max: 1.57, step: 0.01 },
	setAsideInset: { value: PLAYED_CARDS.setAsideInset, min: -1, max: 1.5, step: 0.02 },
	setAsideY: { value: PLAYED_CARDS.setAsideY, min: -2, max: 0.5, step: 0.02 },
	setAsideZ: { value: PLAYED_CARDS.setAsideZ, min: -0.5, max: 1, step: 0.02 },
	...shared(),
});

// Portrait: a vertical column at each team's side.
const portrait = () => ({
	playedScale: { value: PLAYED_CARDS.playedScale, min: 0.05, max: 0.5, step: 0.01 },
	playedGap: { value: PLAYED_CARDS.playedGap, min: -1.5, max: 1, step: 0.01 },
	playedEdge: { value: PLAYED_CARDS.playedEdge, min: -1, max: 2, step: 0.02 },
	playedSetAside: { value: PLAYED_CARDS.playedSetAside, min: 0.3, max: 1, step: 0.02 },
	playedSetAsideOffset: { value: PLAYED_CARDS.playedSetAsideOffset, min: -2, max: 2, step: 0.02 },
	playedCenter: { value: PLAYED_CARDS.playedCenter, min: -2, max: 2, step: 0.02 },
	...shared(),
});

/** Played-card placement, in a "Played Cards" folder with Landscape / Portrait sub-folders. */
export const usePlayedCardControls = (orientation: Orientation = "landscape"): PlayedCardControls =>
	useOrientationFolder<PlayedCardControls>("Played Cards", landscape(), portrait(), orientation);
