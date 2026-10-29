import { useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { InkStrokeButton } from "../../atoms";
import { useGame, canConfirm } from "../../../state";
import { useSession } from "../../../net";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { useVictoryShown } from "../../../state/victoryReveal";
import { useQuitMenuOpen } from "../../../state/quitMenu";
import { useIsPortrait } from "../../../hooks/useIsPortrait";
import { useLagged } from "../../../hooks/useLagged";
import { useWinBannerControls } from "../../../hooks/useWinBannerControls";
import { useT } from "../../../i18n";

interface Action {
	label: string;
	onClick: () => void;
}

// Same footprint as a lobby menu stroke, so every button in the app reads as one family.
const STROKE_WIDTH = "min(300px, 78vw)";
// The two end-of-duel actions share one row, centred under the victory screen.
const END_STROKE_WIDTH = "min(260px, 42vw)";

/**
 * The button takes taps only once its entrance has finished. On touch, the tap that places the second
 * card is followed by the browser's click at the same spot — and CONFERMA mounts right under it (bottom
 * centre, over the hand), so that stray click would confirm the turn on its own. Keyed per action, so
 * every fresh mount starts disarmed.
 */
const ArmedAction = ({ action, style, variant }: { action: Action; style: CSSProperties; variant?: 0 | 1 | 2 }) => {
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
			<InkStrokeButton onClick={action.onClick} variant={variant}>{action.label}</InkStrokeButton>
		</motion.div>
	);
};

/**
 * The duel's action button — the same sumi brush stroke as every lobby button (`InkStrokeButton`,
 * drawn by the scene's `InkLayer`). While a player is placing it shows CONFERMA only ONCE both
 * cards are down; at the end of the duel — once the victory screen has played its title, seal and
 * tally — NUOVA PARTITA | MENU locally, MENU online, on one centred row. During the timed
 * reveal sequence — and, online, after you've confirmed — it stays hidden. Each new action keys a
 * fresh mount, so its stroke is laid again.
 */
export const ConfirmButton = () => {
	const { state, dispatch, leave } = useGame();
	const t = useT();
	const { mode, viewerTeam } = useSession();
	const mobile = useIsMobile();

	const placing = state.phase === "place" && !state.confirmed[viewerTeam];
	// The end-of-duel actions close the victory screen: they arrive last, after its tally.
	const portrait = useIsPortrait();
	const win = useWinBannerControls();
	const victoryShown = useVictoryShown();
	const over = useLagged(state.phase === "game-over" && victoryShown, (portrait ? win.actionsDelayPortrait : win.actionsDelay) * 1000);
	// Stepped aside while the "abandon the duel?" dialog is up — its own strokes take the stage.
	const menuOpen = useQuitMenuOpen();

	const config: Action | null = !menuOpen && placing && canConfirm(state, viewerTeam) ? { label: t("duel.confirm"), onClick: () => dispatch({ type: "CONFIRM_SELECTION" }) } : null;
	const menu: Action = { label: t("hud.menu"), onClick: () => leave() };
	const endActions: Action[] = !over ? [] : mode === "online" ? [menu] : [{ label: t("duel.newMatch"), onClick: () => dispatch({ type: "RESET_GAME" }) }, menu];

	if (endActions.length > 0) {
		return (
			<div
				style={{
					position: "fixed",
					left: 0,
					right: 0,
					bottom: "clamp(16px, 3vh, 36px)",
					zIndex: 1500,
					display: "flex",
					justifyContent: "center",
					gap: "clamp(8px, 2vw, 28px)",
					pointerEvents: "none",
				}}
			>
				{endActions.map((action, i) => (
					<ArmedAction key={action.label} action={action} variant={i === 0 ? 1 : 2} style={{ width: END_STROKE_WIDTH }} />
				))}
			</div>
		);
	}

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
