import { AnimatePresence, motion } from "motion/react";
import { useGame } from "../../state";
import { useSession } from "../useSession";

const other = (t: "red" | "blue") => (t === "red" ? "blue" : "red");

/**
 * In-game banner shown online after YOU have locked in your cards but the opponent still hasn't — a
 * thin pill at the top so the board stays visible behind it. Local pass & play never triggers it.
 */
export const WaitingOverlay = () => {
	const { state } = useGame();
	const { mode, localTeam } = useSession();

	const waiting =
		mode === "online" && localTeam != null && state.phase === "place" && state.confirmed[localTeam] && !state.confirmed[other(localTeam)];

	return (
		<AnimatePresence>
			{waiting && (
				<motion.div
					initial={{ opacity: 0, y: -16 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -16 }}
					transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
					style={{
						position: "fixed",
						top: "clamp(14px, 3vh, 32px)",
						left: "50%",
						transform: "translateX(-50%)",
						zIndex: 1800,
						display: "flex",
						alignItems: "center",
						gap: 12,
						padding: "10px 22px",
						background: "rgba(20, 18, 16, 0.78)",
						border: "1px solid rgba(255,255,255,0.14)",
						borderRadius: 999,
						backdropFilter: "blur(6px)",
						color: "#f2ead9",
						fontSize: 14,
						letterSpacing: 2,
						whiteSpace: "nowrap",
					}}
				>
					<motion.span
						animate={{ opacity: [0.3, 1, 0.3] }}
						transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
						style={{ width: 8, height: 8, borderRadius: "50%", background: "#f0c26a" }}
					/>
					IN ATTESA DELL'AVVERSARIO…
				</motion.div>
			)}
		</AnimatePresence>
	);
};
