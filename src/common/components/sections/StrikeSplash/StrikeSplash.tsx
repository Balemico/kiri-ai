import { motion } from "motion/react";
import { useGame } from "../../../state";
import { useSession } from "../../../net";
import { useBottomTeam } from "../../../hooks/useBottomTeam";
import { useIsPortrait } from "../../../hooks/useIsPortrait";
import { useGameHudControls } from "../../../hooks/useGameHudControls";
import { attackBeat, useResolutionControls } from "../../../hooks/useResolutionControls";
import { SEAL } from "../../../hudPalette";
import type { Team } from "../../../game";

type Edge = "left" | "right" | "top" | "bottom";

const GRADIENT_AT: Record<Edge, string> = {
	left: "ellipse 55% 90% at 0% 50%",
	right: "ellipse 55% 90% at 100% 50%",
	top: "ellipse 110% 45% at 50% 0%",
	bottom: "ellipse 110% 45% at 50% 100%",
};

/** The struck player's edge of the screen flushes vermilion, then fades. */
const EdgeFlush = ({ edge, delay, seconds }: { edge: Edge; delay: number; seconds: number }) => (
	<motion.div
		initial={{ opacity: 0 }}
		animate={{ opacity: [0, 0.6, 0.3, 0] }}
		transition={{ duration: seconds, delay, times: [0, 0.06, 0.5, 1], ease: "easeOut" }}
		style={{ position: "absolute", inset: 0, background: `radial-gradient(${GRADIENT_AT[edge]}, ${SEAL}70, transparent 70%)` }}
	/>
);

/** A clash: blades meet — a brief white flash. */
const ClashFlash = ({ delay }: { delay: number }) => (
	<motion.div
		initial={{ opacity: 0 }}
		animate={{ opacity: [0, 0.7, 0] }}
		transition={{ duration: 0.45, delay, times: [0, 0.12, 1] }}
		style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 50%, #ffffff, #ffffffaa 40%, transparent 75%)" }}
	/>
);

/**
 * Screen-space punctuation for each resolved action, on the attack beat (the same one the pawns
 * strike on): the struck player's side of the screen flushes red — the ink burst itself sits on the
 * pawn (Battlefield) — and a clash flashes white. Keyed by `round-slot` so each action plays once;
 * the layers animate back to invisible on their own, so there's no timer state to clean up.
 */
export const StrikeSplash = () => {
	const { state } = useGame();
	const { viewerTeam } = useSession();
	const bottomTeam = useBottomTeam(viewerTeam);
	const portrait = useIsPortrait();
	const { splashSeconds } = useGameHudControls();
	const beats = useResolutionControls();
	const res = state.lastResolution;
	if (!res) return null;

	const delay = attackBeat(res, beats);
	const edgeOf = (team: Team): Edge => (portrait ? (team === bottomTeam ? "bottom" : "top") : team === "red" ? "left" : "right");
	// `hit` = this player's attack connected, so the flush lands on the OTHER side.
	const struck = (["red", "blue"] as Team[]).filter((t) => res[t === "red" ? "blue" : "red"].hit);

	return (
		<div key={`${state.round}-${res.slot}`} style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 1100 }}>
			{res.clash ? <ClashFlash delay={delay} /> : struck.map((team) => <EdgeFlush key={team} edge={edgeOf(team)} delay={delay} seconds={splashSeconds} />)}
		</div>
	);
};
