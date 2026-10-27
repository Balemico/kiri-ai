import { useControls } from "leva";
import { SEAL_DISC } from "../layout";

export interface SealDiscControls {
	/** Rim width, as a fraction of the disc size. */
	rim: number;
	/** Rim highlight/shadow strength. */
	bevel: number;
	/** How deep the face sits below the rim. */
	depth: number;
	/** How far the kanji stands out of the face. */
	relief: number;
	/** Specular sheen on the upper-left. */
	gloss: number;
}

/** Live-tunable carving of the team seal discs, in its own collapsed Leva folder. */
export const useSealDiscControls = (): SealDiscControls =>
	useControls(
		"Seal Disc",
		{
			rim: { value: SEAL_DISC.rim, min: 0, max: 0.25, step: 0.005 },
			bevel: { value: SEAL_DISC.bevel, min: 0, max: 1, step: 0.05 },
			depth: { value: SEAL_DISC.depth, min: 0, max: 3, step: 0.1 },
			relief: { value: SEAL_DISC.relief, min: 0, max: 3, step: 0.1 },
			gloss: { value: SEAL_DISC.gloss, min: 0, max: 1, step: 0.05 },
		},
		{ collapsed: true },
	);
