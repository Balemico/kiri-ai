import { useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { InkStrokeButton } from "../../atoms";
import { useGame, canConfirm } from "../../../state";
import { useSession } from "../../../net";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { useVictoryShown } from "../../../state/victoryReveal";
import { useQuitMenuOpen } from "../../../state/quitMenu";

interface Action {
	label: string;
	onClick: () => void;
}

// Same footprint as a lobby menu stroke, so every button in the app reads as one family.
const STROKE_WIDTH = "min(300px, 78vw)";

/**
 * The button takes taps only once its entrance has finished. On touch, the tap that places the second
 * card is followed by the browser's click at the same spot — and CONFERMA mounts right under it (bottom
 * centre, over the hand), so that stray click would confirm the turn on its own. Keyed per action, so
 * every fresh mount starts disarmed.
 */
const ArmedAction = ({ action, style }: { action: Action; style: CSSProperties }) => {
	const [armed, setArmed] = useState(false);
	return (
		<motion.div
			initial={{ opacity: 0, y: 16 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: 16 }}
			transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
			onAnimationComplete={() => setArmed(true)}
			style={{ ...style, pointerEvents: armed ? "auto" : "none" }}
		>
			<InkStrokeButton onClick={action.onClick}>{action.label}</InkStrokeButton>
		</motion.div>
	);
};

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
	// The end-of-duel action comes in with the victory screen, after the loser has fallen.
	const victoryShown = useVictoryShown();
	const over = state.phase === "game-over" && victoryShown;
	// Stepped aside while the "abandon the duel?" dialog is up — its own strokes take the stage.
	const menuOpen = useQuitMenuOpen();

	const config: Action | null = menuOpen
		? null
		: placing && canConfirm(state, viewerTeam)
			? { label: "CONFERMA", onClick: () => dispatch({ type: "CONFIRM_SELECTION" }) }
			: over
				? mode === "online"
					? { label: "MENU", onClick: () => leave() }
					: { label: "NUOVA PARTITA", onClick: () => dispatch({ type: "RESET_GAME" }) }
				: null;

	return (
		<AnimatePresence mode="wait">
			{config && (
				<ArmedAction
					key={config.label}
					action={config}
					style={{
						position: "fixed",
						bottom: "clamp(16px, 3vh, 36px)",
						width: STROKE_WIDTH,
						zIndex: 1500,
						// Mobile: centred along the bottom edge (thumb-reachable); desktop: pinned bottom-right.
						...(mobile ? { left: "50%", marginLeft: `calc(${STROKE_WIDTH} / -2)` } : { right: "clamp(36px, 4vw, 64px)" }),
					}}
				/>
			)}
		</AnimatePresence>
	);
};
