import { useControls, button } from "leva";
import { SLASH } from "../layout";

export interface SlashControls {
	color: string;
	angle: number;
	lengthScale: number;
	widthScale: number;
	opacity: number;
	baseFade: number;
	inDur: number;
	growDur: number;
	outDur: number;
}

/** Live-tunable sword-cut effect, in its own collapsed Leva folder, with a Play button to preview it.
 * `onPlay` should be stable (useCallback) so Leva keeps the latest handler. */
export const useSlashControls = (onPlay: () => void): SlashControls => {
	const values = useControls(
		"Slash",
		{
			"▶ Play on pawns": button(() => onPlay()),
			color: SLASH.color,
			angle: { value: SLASH.angle, min: -1.57, max: 1.57, step: 0.01 },
			lengthScale: { value: SLASH.lengthScale, min: 0.5, max: 3, step: 0.01 },
			widthScale: { value: SLASH.widthScale, min: 0.05, max: 1.2, step: 0.01 },
			opacity: { value: SLASH.opacity, min: 0, max: 1, step: 0.01 },
			baseFade: { value: SLASH.baseFade, min: 0, max: 1, step: 0.01 },
			inDur: { value: SLASH.inDur, min: 0.01, max: 0.5, step: 0.01 },
			growDur: { value: SLASH.growDur, min: 0.05, max: 1, step: 0.01 },
			outDur: { value: SLASH.outDur, min: 0.01, max: 0.6, step: 0.01 },
		},
		{ collapsed: true },
	);
	// The button is not part of the returned values; the rest matches SlashControls.
	return values as unknown as SlashControls;
};
