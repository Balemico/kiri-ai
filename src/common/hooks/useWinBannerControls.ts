import { useControls } from "leva";
import { WIN_BANNER } from "../layout";
import type { Team } from "../game";

export interface WinBannerControls {
	/** Show the banner without a real winner, to tune it. */
	testVictory: boolean;
	/** Which team's victory to preview when testing. */
	testTeam: Team;
	/** Vertical position from the top, as a fraction of viewport height. */
	offsetTop: number;
	/** Multiplier on the base display font size. */
	fontScale: number;
	/** Time for the brush stroke to sweep across, before the words appear (seconds). */
	spreadSeconds: number;
	/** Delay between each letter starting (< letterDuration → letters overlap). */
	letterStagger: number;
	/** How long each letter takes to fade/rise in (seconds). */
	letterDuration: number;
}

/** Live-tunable victory banner + ink shader, in its own collapsed Leva folder. */
export const useWinBannerControls = (): WinBannerControls =>
	useControls(
		"Win Banner",
		{
			testVictory: { value: WIN_BANNER.testVictory, label: "test victory" },
			testTeam: { value: WIN_BANNER.testTeam, options: ["red", "blue"] as Team[], label: "test team" },
			offsetTop: { value: WIN_BANNER.offsetTop, min: 0, max: 0.5, step: 0.01 },
			fontScale: { value: WIN_BANNER.fontScale, min: 0.5, max: 4, step: 0.05 },
			spreadSeconds: { value: WIN_BANNER.spreadSeconds, min: 0.3, max: 4, step: 0.1, label: "brush sweep (s)" },
			letterStagger: { value: WIN_BANNER.letterStagger, min: 0, max: 0.3, step: 0.005, label: "letter stagger (s)" },
			letterDuration: { value: WIN_BANNER.letterDuration, min: 0.05, max: 1.2, step: 0.05, label: "letter duration (s)" },
		},
		{ collapsed: true },
	);
