import { FLOOR, FLOOR_PORTRAIT, type Orientation } from "../layout";
import { useOrientationFolder } from "./useOrientationFolder";

export interface FloorControls {
	tilt: number;
	yNudge: number;
	z: number;
	widthScale: number;
	tint: number;
	opacity: number;
}

const schema = (d: typeof FLOOR | typeof FLOOR_PORTRAIT) => ({
	tilt: { value: d.tilt, min: 0, max: 1.4, step: 0.01 },
	yNudge: { value: d.yNudge, min: -1.5, max: 1.5, step: 0.02 },
	z: { value: d.z, min: -1.5, max: 1, step: 0.02 },
	widthScale: { value: d.widthScale, min: 1, max: 3, step: 0.05 },
	tint: { value: d.tint, min: 0.6, max: 1, step: 0.01 },
	opacity: { value: d.opacity, min: 0, max: 1, step: 0.05 },
});

/**
 * The "Floor" Leva folder, with Landscape / Portrait sub-folders (portrait fills the screen, so it
 * uses a gentler rake / tighter width by default). Lifted into a shared hook so the Battlefield can
 * rake its pieces onto the SAME tilt the floor uses.
 */
export const useFloorControls = (orientation: Orientation): FloorControls =>
	useOrientationFolder<FloorControls>("Floor", schema(FLOOR), schema(FLOOR_PORTRAIT), orientation);
