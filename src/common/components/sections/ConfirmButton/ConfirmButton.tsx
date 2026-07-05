import { AnimatePresence, motion } from "motion/react";
import { Typography } from "../../atoms";
import { useGame, canConfirm } from "../../../state";
import { useSession } from "../../../net";
import { useCoarsePointer } from "../../../hooks/useCoarsePointer";

// Classic vermillion of a hanko (name seal) — reads as "Japanese" without being a team colour.
const SEAL = "#b73225";

interface Action {
	/** Kanji shown inside the hanko seal. */
	kanji: string;
	label: string;
	onClick: () => void;
	/** Whether the seal is "armed" (lit + interactive). */
	enabled: boolean;
}

/**
 * Elegant sumi-e action control, fixed bottom-right. While a player is placing it shows CONFIRM
 * (decision kanji 決) only ONCE both cards are down (hidden until the selection is complete); on
 * game-over it becomes NEW GAME locally (renewal kanji 新) or MENU online (return kanji 戻). During
 * the timed reveal sequence — and, online, after you've confirmed — it stays hidden. Breathes when armed.
 */
export const ConfirmButton = () => {
	const { state, dispatch } = useGame();
	const { mode, viewerTeam, leave } = useSession();
	// Touch: centre the control along the bottom edge (thumb-reachable), rather than pinned bottom-right.
	const coarse = useCoarsePointer();

	const placing = state.phase === "place" && !state.confirmed[viewerTeam];
	const over = state.phase === "game-over";

	const config: Action | null =
		placing && canConfirm(state, viewerTeam)
			? { kanji: "決", label: "CONFIRM", onClick: () => dispatch({ type: "CONFIRM_SELECTION" }), enabled: true }
			: over
				? mode === "online"
					? { kanji: "戻", label: "MENU", onClick: () => leave(), enabled: true }
					: { kanji: "新", label: "NEW GAME", onClick: () => dispatch({ type: "RESET_GAME" }), enabled: true }
				: null;

	return (
		<AnimatePresence mode="wait">
			{config && (
				<motion.div
					key={config.label}
					initial={{ opacity: 0, y: 24 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: 24 }}
					transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
					style={
						coarse
							? { position: "fixed", left: 0, right: 0, bottom: "clamp(20px, 3vh, 40px)", display: "flex", justifyContent: "center", zIndex: 1500 }
							: { position: "fixed", right: "clamp(20px, 3vw, 44px)", bottom: "clamp(20px, 3vh, 40px)", zIndex: 1500 }
					}
				>
					<motion.button
						type="button"
						disabled={!config.enabled}
						onClick={config.onClick}
						aria-label={config.label}
						initial={false}
						animate={{ opacity: config.enabled ? 1 : 0.45 }}
						whileHover={config.enabled ? { scale: 1.04 } : undefined}
						whileTap={config.enabled ? { scale: 0.96 } : undefined}
						transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
						style={{
							display: "flex",
							alignItems: "center",
							gap: 16,
							padding: "12px 26px 12px 14px",
							background: "rgba(20, 18, 16, 0.72)",
							border: "1px solid rgba(255, 255, 255, 0.14)",
							borderRadius: 999,
							backdropFilter: "blur(6px)",
							boxShadow: "0 8px 28px rgba(0, 0, 0, 0.4)",
							cursor: config.enabled ? "pointer" : "default",
						}}
					>
						{/* Hanko seal — vermillion disc with the action kanji, gently breathing when armed. */}
						<motion.span
							animate={config.enabled ? { boxShadow: ["0 0 0 0 rgba(183,50,37,0)", "0 0 0 6px rgba(183,50,37,0.18)", "0 0 0 0 rgba(183,50,37,0)"] } : {}}
							transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
							style={{
								display: "grid",
								placeItems: "center",
								width: 42,
								height: 42,
								borderRadius: "50%",
								background: config.enabled ? SEAL : "rgba(120, 120, 120, 0.35)",
								color: "#f5ede0",
								fontSize: 22,
								lineHeight: 1,
								// Genjiro display face for the kanji.
								fontFamily: "var(--font-display)",
							}}
						>
							{config.kanji}
						</motion.span>
						<Typography as="span" variant="section-label" style={{ fontSize: 16, letterSpacing: "5px", paddingTop: 1 }}>
							{config.label}
						</Typography>
					</motion.button>
				</motion.div>
			)}
		</AnimatePresence>
	);
};
