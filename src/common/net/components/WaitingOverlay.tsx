import { AnimatePresence, motion } from "motion/react";
import { useGame } from "../../state";
import { useSession } from "../useSession";
import { InkStrokeLabel } from "../../components/atoms";
import { useGameHudControls } from "../../hooks/useGameHudControls";
import { useIsPortrait } from "../../hooks/useIsPortrait";
import { GAME_HUD } from "../../layout";

const other = (t: "red" | "blue") => (t === "red" ? "blue" : "red");

/** px between the bottom of the opponent's banner and the message. */
const GAP_BELOW_BANNER = 8;

/**
 * In-game note shown online after YOU have locked in your cards but the opponent still hasn't —
 * painted on a sumi stroke right under the OPPONENT's banner (red top-left, blue top-right), so it
 * reads as that player's status. Local pass & play never triggers it.
 */
export const WaitingOverlay = () => {
	const { state } = useGame();
	const { mode, localTeam } = useSession();
	const hud = useGameHudControls();
	const portrait = useIsPortrait();

	const opponent = localTeam != null ? other(localTeam) : "blue";
	const waiting =
		mode === "online" && localTeam != null && state.phase === "place" && state.confirmed[localTeam] && !state.confirmed[opponent];
	const scale = portrait ? hud.portraitScale : hud.scale;
	const left = opponent === "red";

	return (
		<AnimatePresence>
			{waiting && (
				<motion.div
					initial={{ opacity: 0, y: -12 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -12 }}
					transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
					style={{
						position: "fixed",
						top: hud.inset + GAME_HUD.bannerHeight * scale + GAP_BELOW_BANNER,
						// Same side + inset as the opponent's banner. No `transform` string: Motion owns it here.
						...(left ? { left: hud.inset } : { right: hud.inset }),
						zIndex: 1800,
						pointerEvents: "none",
					}}
				>
					<InkStrokeLabel
						tone="ink"
						style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "0.9em 1.8em 0.6em", fontSize: 12 * scale, letterSpacing: 2, whiteSpace: "nowrap" }}
					>
						<motion.span
							animate={{ opacity: [0.3, 1, 0.3] }}
							transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
							style={{ width: 7, height: 7, borderRadius: "50%", background: "#f0c26a" }}
						/>
						IN ATTESA DELL'AVVERSARIO…
					</InkStrokeLabel>
				</motion.div>
			)}
		</AnimatePresence>
	);
};
