import { BATTLEGROUND, type Orientation } from "../layout";
import { useOrientationFolder } from "./useOrientationFolder";

export interface BattlegroundControls {
	// Landscape
	x: number;
	y: number;
	diamondTilt: number;
	sharedOffset: number;
	// Portrait
	baseY: number;
	laneOffset: number;
	pawnLift: number;
	thickness: number;
	handReserve: number;
	margin: number;
}

const x = () => ({ x: { value: BATTLEGROUND.x, min: -3, max: 3, step: 0.02 } });
// Marker/diamond/line-width size auto-scales with the line (window-proportional, same in both
// orientations); this knob is a shared fine-tune multiplier on top (1 = the natural proportion).
const thickness = () => ({ thickness: { value: BATTLEGROUND.thickness, min: 0.2, max: 4, step: 0.05 } });

// Landscape: the horizontal board line on the floor band.
const landscape = () => ({
	...x(),
	y: { value: BATTLEGROUND.y, min: -2.5, max: 2.5, step: 0.02 },
	diamondTilt: { value: BATTLEGROUND.diamondTilt, min: 0, max: 1.57, step: 0.01 },
	sharedOffset: { value: BATTLEGROUND.sharedOffset, min: 0, max: 0.5, step: 0.005 },
	...thickness(),
});

// Portrait: the vertical raked line, with pawns/markers to its sides (rake comes from the floor tilt).
const portrait = () => ({
	...x(),
	baseY: { value: BATTLEGROUND.baseY, min: -2, max: 2, step: 0.02 },
	laneOffset: { value: BATTLEGROUND.laneOffset, min: 0, max: 1.5, step: 0.02 },
	pawnLift: { value: BATTLEGROUND.pawnLift, min: -1.5, max: 1.5, step: 0.02 },
	...thickness(),
	handReserve: { value: BATTLEGROUND.handReserve, min: 0, max: 0.8, step: 0.01 },
	margin: { value: BATTLEGROUND.margin, min: 0, max: 0.4, step: 0.01 },
});

/** Battleground (board + pawns) geometry, in a "Battleground" folder with Landscape / Portrait sub-folders. */
export const useBattlegroundControls = (orientation: Orientation = "landscape"): BattlegroundControls =>
	useOrientationFolder<BattlegroundControls>("Battleground", landscape(), portrait(), orientation);
