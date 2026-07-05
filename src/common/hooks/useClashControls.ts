import { useControls, button } from "leva";
import { CLASH, type ClashConfig } from "../layout";

export type ClashControls = ClashConfig;

/**
 * Live-tunable parry effect, in its own collapsed Leva folder, with a Play button to preview it.
 * On a clash two yellow blades cross to form an X above the pawns' midpoint; these knobs place it
 * (the blade look — colour/size/durations — is shared with the "Slash" folder). Defaults from CLASH.
 * `onPlay` should be stable (useCallback) so Leva keeps the latest handler.
 */
export const useClashControls = (onPlay: () => void): ClashControls => {
	const values = useControls(
		"Clash",
		{
			"▶ Play clash": button(() => onPlay()),
			tilt: { value: CLASH.tilt, min: 0, max: 1.2, step: 0.01 },
			sizeScale: { value: CLASH.sizeScale, min: 0.3, max: 2, step: 0.01 },
			yLift: { value: CLASH.yLift, min: -1, max: 1.5, step: 0.02 },
			hold: { value: CLASH.hold, min: 0, max: 1, step: 0.01 },
		},
		{ collapsed: true },
	);
	// The button is not part of the returned values; the rest matches ClashControls.
	return values as unknown as ClashControls;
};
