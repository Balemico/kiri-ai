import { AnimatePresence, motion } from "motion/react";
import { InkStrokeButton } from "../../atoms";
import { useGame, canConfirm } from "../../../state";
import { useSession } from "../../../net";
import { useIsMobile } from "../../../hooks/useIsMobile";

interface Action {
	label: string;
	onClick: () => void;
}

// Same footprint as a lobby menu stroke, so every button in the app reads as one family.
const STROKE_WIDTH = "min(300px, 78vw)";

/**
 * The duel's action button — the same sumi brush stroke as every lobby button (`InkStrokeButton`,
 * drawn by the scene's `InkLayer`). While a player is placing it shows CONFERMA only ONCE both
 * cards are down; on game-over it becomes NUOVA PARTITA locally or MENU online. During the timed
 * reveal sequence — and, online, after you've confirmed — it stays hidden. Each new action keys a
 * fresh mount, so its stroke is laid again.
 */
export const ConfirmButton = () => {
	const { state, dispatch } = useGame();
	const { mode, viewerTeam, leave } = useSession();
	const mobile = useIsMobile();

	const placing = state.phase === "place" && !state.confirmed[viewerTeam];
	const over = state.phase === "game-over";

	const config: Action | null =
		placing && canConfirm(state, viewerTeam)
			? { label: "CONFERMA", onClick: () => dispatch({ type: "CONFIRM_SELECTION" }) }
			: over
				? mode === "online"
					? { label: "MENU", onClick: () => leave() }
					: { label: "NUOVA PARTITA", onClick: () => dispatch({ type: "RESET_GAME" }) }
				: null;

	return (
		<AnimatePresence mode="wait">
			{config && (
				<motion.div
					key={config.label}
					initial={{ opacity: 0, y: 16 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: 16 }}
					transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
					style={{
						position: "fixed",
						bottom: "clamp(16px, 3vh, 36px)",
						width: STROKE_WIDTH,
						zIndex: 1500,
						// Mobile: centred along the bottom edge (thumb-reachable); desktop: pinned bottom-right.
						...(mobile ? { left: "50%", marginLeft: `calc(${STROKE_WIDTH} / -2)` } : { right: "clamp(36px, 4vw, 64px)" }),
					}}
				>
					<InkStrokeButton onClick={config.onClick}>{config.label}</InkStrokeButton>
				</motion.div>
			)}
		</AnimatePresence>
	);
};
