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
	/** Silence after the loser has fallen flat, before the victory screen comes in (seconds). */
	afterFall: number;
	/** Landscape: seconds into the victory screen before the title stroke is laid. */
	titleDelay: number;
	/** Seconds into the victory screen before NUOVA PARTITA / MENU arrive (landscape / portrait). */
	actionsDelay: number;
	actionsDelayPortrait: number;
	/** Landscape push-in on the winner: duration, distance closed, x drift toward the winner, y rise. */
	cameraDur: number;
	cameraPush: number;
	cameraShift: number;
	cameraLift: number;
	/** Falling maple leaves over the victory stage (landscape). */
	leafCount: number;
}

/** Live-tunable victory screen, in its own collapsed Leva folder. */
export const useWinBannerControls = (): WinBannerControls =>
	useControls(
		"Win Banner",
		{
			testVictory: { value: WIN_BANNER.testVictory, label: "test victory" },
			testTeam: { value: WIN_BANNER.testTeam, options: ["red", "blue"] as Team[], label: "test team" },
			offsetTop: { value: WIN_BANNER.offsetTop, min: 0, max: 0.5, step: 0.01 },
			fontScale: { value: WIN_BANNER.fontScale, min: 0.2, max: 4, step: 0.05 },
			spreadSeconds: { value: WIN_BANNER.spreadSeconds, min: 0.3, max: 4, step: 0.1, label: "brush sweep (s)" },
			letterStagger: { value: WIN_BANNER.letterStagger, min: 0, max: 0.3, step: 0.005, label: "letter stagger (s)" },
			letterDuration: { value: WIN_BANNER.letterDuration, min: 0.05, max: 1.2, step: 0.05, label: "letter duration (s)" },
			afterFall: { value: WIN_BANNER.afterFall, min: 0, max: 3, step: 0.05, label: "silence after fall (s)" },
			titleDelay: { value: WIN_BANNER.titleDelay, min: 0, max: 3, step: 0.05, label: "title delay (s)" },
			actionsDelay: { value: WIN_BANNER.actionsDelay, min: 0, max: 6, step: 0.1, label: "actions delay (s)" },
			actionsDelayPortrait: { value: WIN_BANNER.actionsDelayPortrait, min: 0, max: 6, step: 0.1, label: "actions delay portrait (s)" },
			cameraDur: { value: WIN_BANNER.cameraDur, min: 0.5, max: 10, step: 0.1, label: "camera push (s)" },
			cameraPush: { value: WIN_BANNER.cameraPush, min: 0, max: 0.5, step: 0.01, label: "camera closer" },
			cameraShift: { value: WIN_BANNER.cameraShift, min: 0, max: 1, step: 0.01, label: "camera → winner" },
			cameraLift: { value: WIN_BANNER.cameraLift, min: -0.5, max: 0.5, step: 0.01, label: "camera lift" },
			leafCount: { value: WIN_BANNER.leafCount, min: 0, max: 44, step: 1, label: "leaves" },
		},
		{ collapsed: true },
	);
