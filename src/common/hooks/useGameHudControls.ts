import { button, useControls } from "leva";
import { GAME_HUD } from "../layout";
import { hitPreview } from "../state/hitPreview";

export interface GameHudControls {
	/** px from the screen edges to the banners / round marker. */
	inset: number;
	/** Landscape size multiplier for banners + round marker. */
	scale: number;
	/** Portrait size multiplier. */
	portraitScale: number;
	/** Delay after a confirm before the pass-the-device veil inks in (ms). */
	handoffDelayMs: number;
	/** Duel opening: s after the samurai have stood up before the HUD animates in. */
	introHudDelay: number;
	/** Duel opening: s after the HUD before the first turn begins (the hand rises). */
	introTurnDelay: number;
	/** Delay between the reveal and a life seal breaking (ms). */
	hitLagMs: number;
	/** How long the hit ink lingers (s). */
	splashSeconds: number;
	/** Opacity of a banner whose player is not acting. */
	idleOpacity: number;
	/** Resting tone of the top-corner vignette behind the banners. */
	vignetteShade: string;
	/** Alpha of the resting shade at the corner (0 = off). */
	vignetteShadeOpacity: number;
	/** Alpha of the acting team's colour glow at the corner. */
	vignetteGlowOpacity: number;
	/** Glow tone of the red / blue corner. */
	vignetteRed: string;
	vignetteBlue: string;
	/** Online: alpha an idle corner keeps in its team colour (instead of resting in black). */
	vignetteIdleGlowOpacity: number;
	/** Vignette extent across, as a fraction of the viewport width. */
	vignetteWidth: number;
	/** Vignette extent down, as a fraction of the viewport height. */
	vignetteHeight: number;
	/** Portrait vignette extent across / down. */
	vignetteWidthPortrait: number;
	vignetteHeightPortrait: number;
	/** Seconds for one slow breath of the vignette. */
	vignetteDrift: number;
	/** Alpha of the full-screen dark edge vignette in the corners (0 = off). */
	edgeVignetteOpacity: number;
	/** Portrait alpha of the edge vignette. */
	edgeVignetteOpacityPortrait: number;
}

/** Live-tunable in-game HUD, in its own collapsed Leva folder (with a button replaying a landed hit). */
export const useGameHudControls = (): GameHudControls =>
	useControls(
		"Game HUD",
		{
			"▶ Play hit": button(() => hitPreview.play()),
			inset: { value: GAME_HUD.inset, min: 0, max: 80, step: 1 },
			scale: { value: GAME_HUD.scale, min: 0.5, max: 2, step: 0.05 },
			portraitScale: { value: GAME_HUD.portraitScale, min: 0.4, max: 1.5, step: 0.02, label: "portrait scale" },
			handoffDelayMs: { value: GAME_HUD.handoffDelayMs, min: 0, max: 2000, step: 50, label: "handoff delay (ms)" },
			introHudDelay: { value: GAME_HUD.introHudDelay, min: 0, max: 2, step: 0.05, label: "intro: HUD after stand (s)" },
			introTurnDelay: { value: GAME_HUD.introTurnDelay, min: 0, max: 3, step: 0.05, label: "intro: turn after HUD (s)" },
			hitLagMs: { value: GAME_HUD.hitLagMs, min: 0, max: 1500, step: 50, label: "hit lag (ms)" },
			splashSeconds: { value: GAME_HUD.splashSeconds, min: 0.4, max: 4, step: 0.1, label: "splash (s)" },
			idleOpacity: { value: GAME_HUD.idleOpacity, min: 0, max: 1, step: 0.05, label: "idle banner opacity" },
			vignetteShade: { value: GAME_HUD.vignetteShade, label: "vignette shade" },
			vignetteShadeOpacity: { value: GAME_HUD.vignetteShadeOpacity, min: 0, max: 1, step: 0.05, label: "shade opacity" },
			vignetteGlowOpacity: { value: GAME_HUD.vignetteGlowOpacity, min: 0, max: 1, step: 0.05, label: "glow opacity" },
			vignetteRed: { value: GAME_HUD.vignetteRed, label: "vignette red" },
			vignetteBlue: { value: GAME_HUD.vignetteBlue, label: "vignette blue" },
			vignetteIdleGlowOpacity: { value: GAME_HUD.vignetteIdleGlowOpacity, min: 0, max: 1, step: 0.05, label: "online idle glow" },
			vignetteWidth: { value: GAME_HUD.vignetteWidth, min: 0.1, max: 1, step: 0.01, label: "vignette width" },
			vignetteHeight: { value: GAME_HUD.vignetteHeight, min: 0.1, max: 1, step: 0.01, label: "vignette height" },
			vignetteWidthPortrait: { value: GAME_HUD.vignetteWidthPortrait, min: 0.1, max: 1, step: 0.01, label: "vignette width (portrait)" },
			vignetteHeightPortrait: { value: GAME_HUD.vignetteHeightPortrait, min: 0.05, max: 1, step: 0.01, label: "vignette height (portrait)" },
			vignetteDrift: { value: GAME_HUD.vignetteDrift, min: 2, max: 30, step: 0.5, label: "vignette breath (s)" },
			edgeVignetteOpacity: { value: GAME_HUD.edgeVignetteOpacity, min: 0, max: 1, step: 0.05, label: "edge vignette" },
			edgeVignetteOpacityPortrait: { value: GAME_HUD.edgeVignetteOpacityPortrait, min: 0, max: 1, step: 0.05, label: "edge vignette (portrait)" },
		},
		{ collapsed: true },
	);
