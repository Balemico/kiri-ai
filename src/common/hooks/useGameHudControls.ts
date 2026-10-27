import { useControls } from "leva";
import { GAME_HUD } from "../layout";

export interface GameHudControls {
	/** px from the screen edges to the banners / round marker. */
	inset: number;
	/** Landscape size multiplier for banners + round marker. */
	scale: number;
	/** Portrait size multiplier. */
	portraitScale: number;
	/** Delay after a confirm before the pass-the-device veil inks in (ms). */
	handoffDelayMs: number;
	/** Delay between the reveal and a life seal breaking (ms). */
	hitLagMs: number;
	/** Size multiplier for the hit ink splash. */
	splashScale: number;
	/** How long the hit splash lingers (s). */
	splashSeconds: number;
}

/** Live-tunable in-game HUD, in its own collapsed Leva folder. */
export const useGameHudControls = (): GameHudControls =>
	useControls(
		"Game HUD",
		{
			inset: { value: GAME_HUD.inset, min: 0, max: 80, step: 1 },
			scale: { value: GAME_HUD.scale, min: 0.5, max: 2, step: 0.05 },
			portraitScale: { value: GAME_HUD.portraitScale, min: 0.4, max: 1.5, step: 0.02, label: "portrait scale" },
			handoffDelayMs: { value: GAME_HUD.handoffDelayMs, min: 0, max: 2000, step: 50, label: "handoff delay (ms)" },
			hitLagMs: { value: GAME_HUD.hitLagMs, min: 0, max: 1500, step: 50, label: "hit lag (ms)" },
			splashScale: { value: GAME_HUD.splashScale, min: 0.3, max: 2.5, step: 0.05, label: "splash scale" },
			splashSeconds: { value: GAME_HUD.splashSeconds, min: 0.4, max: 4, step: 0.1, label: "splash (s)" },
		},
		{ collapsed: true },
	);
