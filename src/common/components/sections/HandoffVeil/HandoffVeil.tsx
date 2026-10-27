import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useGame } from "../../../state";
import { useSession } from "../../../net";
import { useLagged } from "../../../hooks/useLagged";
import { useGameHudControls } from "../../../hooks/useGameHudControls";
import { SealDisc } from "../../atoms";
import { INK, TEAM_INK, TEAM_KANJI, TEAM_NAME, kanjiNumeral } from "../../../hudPalette";
import { PAPER } from "../../../layout";

/**
 * Pass & play only: whenever the device has to change hands (a new placing turn), an opaque washi
 * veil covers the table so the incoming player never sees the outgoing player's hand — and vice
 * versa. A tap lifts it. The game's opening turn (round 1, red) needs no hand-over.
 *
 * Fully derived: the turn that needs a veil is a key (`round-team`); the veil shows once that key
 * has been stable for `handoffDelayMs` (the just-placed cards flip face-down first) until it is the
 * key the player dismissed. Nothing is set inside an effect.
 */
export const HandoffVeil = () => {
	const { state } = useGame();
	const { mode, viewerTeam } = useSession();
	const { handoffDelayMs } = useGameHudControls();
	const [dismissed, setDismissed] = useState<string | null>(null);
	// A game can end in round 1 — forget the last dismissal at game-over so the rematch's "1-blue"
	// hand-over still shows. Adjusted during render ("state from props"), not in an effect.
	if (state.phase === "game-over" && dismissed !== null) setDismissed(null);

	const placing = state.phase === "place" && !state.confirmed[viewerTeam];
	const opening = state.round === 1 && viewerTeam === "red";
	const turnKey = mode === "local" && placing && !opening ? `${state.round}-${viewerTeam}` : null;
	const settledKey = useLagged(turnKey, handoffDelayMs);
	const show = turnKey !== null && settledKey === turnKey && dismissed !== turnKey;

	const team = viewerTeam;
	// The seal's bevel/shadows are px-based, so size it in px: ~22vmin, clamped 110–180.
	const discSize = Math.round(Math.min(180, Math.max(110, 0.22 * Math.min(window.innerWidth, window.innerHeight))));
	return (
		<AnimatePresence>
			{show && (
				<motion.div
					key={turnKey}
					role="button"
					tabIndex={0}
					aria-label={`Tocca al ${TEAM_NAME[team]}: tocca per iniziare`}
					onClick={() => setDismissed(turnKey)}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") setDismissed(turnKey);
					}}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }}
					transition={{ duration: 0.35 }}
					style={{
						position: "fixed",
						inset: 0,
						zIndex: 1800,
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						gap: 18,
						padding: 24,
						background: `${PAPER} url(/images/backgroud/0-base.jpeg) center / cover`,
						color: INK,
						cursor: "pointer",
						userSelect: "none",
						outline: "none",
					}}
				>
					<span style={{ fontSize: 12, letterSpacing: "0.32em", opacity: 0.6, paddingLeft: "0.32em" }}>
						ROUND {kanjiNumeral(state.round)}
					</span>
					<motion.div
						initial={{ scale: 1.6, opacity: 0, rotate: -8 }}
						animate={{ scale: 1, opacity: 1, rotate: -3 }}
						transition={{ duration: 0.4, delay: 0.15, ease: [0.3, 1.4, 0.5, 1] }}
					>
						<SealDisc kanji={TEAM_KANJI[team]} colour={TEAM_INK[team]} size={discSize} />
					</motion.div>
					<motion.h2
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.45, delay: 0.3 }}
						style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "clamp(30px, 6vmin, 52px)", letterSpacing: "0.08em", textAlign: "center" }}
					>
						TOCCA AL <span style={{ color: TEAM_INK[team] }}>{TEAM_NAME[team]}</span>
					</motion.h2>
					<motion.p
						initial={{ opacity: 0 }}
						animate={{ opacity: [0.75, 0.4, 0.75] }}
						transition={{ opacity: { duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.6 } }}
						style={{ margin: 0, fontSize: 13, letterSpacing: "0.18em", textAlign: "center", lineHeight: 1.6 }}
					>
						Passa il dispositivo · tocca per iniziare
					</motion.p>
				</motion.div>
			)}
		</AnimatePresence>
	);
};
