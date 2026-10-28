import { useControls } from "leva";
import { CARD_NAME, type CardNameConfig } from "../layout";

export type CardNameControls = CardNameConfig;

/**
 * The move-name cartouche (size + distance below the played card), in its own collapsed "Card
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
			portraitBottom: { value: CARD_NAME.portraitBottom, min: 0, max: 3, step: 0.05, label: "portrait: bottom" },
			portraitWidth: { value: CARD_NAME.portraitWidth, min: 0.4, max: 1, step: 0.01, label: "portrait: width" },
		},
		{ collapsed: true },
	) as CardNameControls;
