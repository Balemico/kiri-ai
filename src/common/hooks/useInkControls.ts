import { useEffect } from "react";
import { useControls } from "leva";
import { INK } from "../layout";
import { INK_LOOK } from "../ink/inkNodes";

/**
 * Live look of the sumi ink, in its own collapsed Leva folder. The values are written straight
 * into the SHARED shader uniforms (`INK_LOOK`), so every button stroke and the veil retune at once
 * without rebuilding a material.
 */
export const useInkControls = (): void => {
	const c = useControls(
		"Ink",
		{
			bristles: { value: INK.bristles, min: 2, max: 40, step: 0.5, label: "bristle clumps" },
			tailDry: { value: INK.tailDry, min: 0, max: 1.2, step: 0.05, label: "dry tip" },
			edgeDry: { value: INK.edgeDry, min: 0, max: 1.2, step: 0.05, label: "dry flanks" },
			tooth: { value: INK.tooth, min: 0, max: 1, step: 0.05, label: "paper tooth" },
			wash: { value: INK.wash, min: 0, max: 1, step: 0.02, label: "pale wash" },
			splatter: { value: INK.splatter, min: 0, max: 3, step: 0.05 },
			drift: { value: INK.drift, min: 0, max: 0.5, step: 0.01, label: "wash breathing" },
			strokeHeight: { value: INK.strokeHeight, min: 0.3, max: 1.1, step: 0.01, label: "button stroke height" },
			inkColor: { value: INK.inkColor, label: "ink" },
		},
		{ collapsed: true },
	);
	useEffect(() => {
		INK_LOOK.bristles.value = c.bristles;
		INK_LOOK.tailDry.value = c.tailDry;
		INK_LOOK.edgeDry.value = c.edgeDry;
		INK_LOOK.tooth.value = c.tooth;
		INK_LOOK.wash.value = c.wash;
		INK_LOOK.splatter.value = c.splatter;
		INK_LOOK.drift.value = c.drift;
		INK_LOOK.strokeHeight.value = c.strokeHeight;
		INK_LOOK.inkColor.value.set(c.inkColor);
	}, [c]);
};
