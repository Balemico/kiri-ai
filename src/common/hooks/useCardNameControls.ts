import { useControls } from "leva";
import { CARD_NAME, type CardNameConfig } from "../layout";

export type CardNameControls = CardNameConfig;

/**
 * The floating move-name label (size + distance above the played card), in its own collapsed "Card
 * Name" folder. Defaults come from the single CARD_NAME object in layout.ts.
 */
export const useCardNameControls = (): CardNameControls =>
	useControls(
		"Card Name",
		{
			fontScale: { value: CARD_NAME.fontScale, min: 0.3, max: 2, step: 0.02 },
			maxFontPx: { value: CARD_NAME.maxFontPx, min: 8, max: 64, step: 1 },
			minFontPx: { value: CARD_NAME.minFontPx, min: 4, max: 24, step: 1 },
			gap: { value: CARD_NAME.gap, min: -0.3, max: 0.6, step: 0.01 },
		},
		{ collapsed: true },
	) as CardNameControls;
