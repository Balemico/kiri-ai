import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { InkStrokeButton } from "../../atoms";
import { useSession } from "../../../net";
import { InkDelayContext } from "../../../ink/inkDelay";
import { quitMenu, useQuitMenuOpen } from "../../../state/quitMenu";
import { useGame } from "../../../state/useGame";
import { INK } from "../../../hudPalette";
import { PAPER } from "../../../layout";
import { EXIT_DURATION } from "../../../motionPresets";
import { useT } from "../../../i18n";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const STROKE_WIDTH = "min(260px, 70vw)";
// Exit order — the entrance in reverse: the strokes lift (bottom-most last laid, so ESCI then ANNULLA a
// beat apart), then the note, the title, and only once all of it is nearly gone, the veil.
const EXIT_STROKES = [0, 0.06] as const;
const EXIT_NOTE = 0.12;
const EXIT_TITLE = 0.18;
const EXIT_VEIL = EXIT_TITLE + EXIT_DURATION * 0.7;

/**
 * "Abandon the duel?" — opened from the round ensō (`quitMenu`). A washi veil over the table with two
 * ink strokes: ESCI returns to the lobby (online it also closes the room), ANNULLA (or a tap on the
 * veil / Esc) goes back to the duel. The veil sits UNDER the duel's InkLayer (1450) so the strokes
 * paint over it; the labels sit above (1500).
 */
export const QuitDialog = () => {
	const open = useQuitMenuOpen();
	const { mode } = useSession();
	const { leave } = useGame();
	const t = useT();

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") quitMenu.close();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open]);
	// The store outlives the duel: shut on leaving, so the next duel starts without it.
	useEffect(() => () => quitMenu.close(), []);

	return (
		<AnimatePresence>
			{open && (
				// A PLAIN wrapper: animating its opacity would make it one stacking context (z auto) for the
				// whole fade — painted under the duel canvas, then popping in at full opacity. Each layer
				// animates on its own instead: veil → title → note → strokes; out in reverse.
				<div key="quit">
					{/* Washi veil: the table recedes; a tap on it cancels. */}
					<motion.div
						onClick={() => quitMenu.close()}
						initial={{ opacity: 0 }}
						animate={{ opacity: 0.94, transition: { duration: 0.55, ease: EASE_OUT } }}
						// Leaves LAST, once the strokes, note and title are gone (see EXIT_*), so nothing floats over the bare table.
						exit={{ opacity: 0, transition: { duration: 0.45, delay: EXIT_VEIL, ease: "easeInOut" } }}
						style={{
							position: "fixed",
							inset: 0,
							zIndex: 1420,
							background: `${PAPER} url(/images/backgroud/0-base.jpeg) center / cover`,
						}}
					/>
					<div
						role="dialog"
						aria-modal="true"
						aria-label={t("quit.title")}
						style={{
							position: "fixed",
							inset: 0,
							zIndex: 1500,
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							justifyContent: "center",
							gap: 10,
							padding: 24,
							color: INK,
							pointerEvents: "none",
							userSelect: "none",
						}}
					>
						<motion.p
							{...rise(0.22, 1, EXIT_TITLE)}
							style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "clamp(24px, 7vw, 40px)", lineHeight: 1.1, textAlign: "center" }}
						>
							{t("quit.title")}
						</motion.p>
						<motion.p
							{...rise(0.32, 0.65, EXIT_NOTE)}
							style={{ margin: "0 0 18px", fontSize: 12, letterSpacing: "0.2em", textAlign: "center", textTransform: "uppercase" }}
						>
							{t(mode === "online" ? "quit.online" : "quit.local")}
						</motion.p>
						{/* The strokes are laid after the text (InkDelayContext), and lift first on the way out. Each row
						    has its OWN exit (label fading with its stroke's lift): the button itself has none, so
						    without it the labels sat at full opacity until the whole dialog unmounted — after the veil. */}
						<InkDelayContext.Provider value={{ enter: 0.42, exit: EXIT_STROKES[0] }}>
							<motion.div exit={rowExit(EXIT_STROKES[0])} style={{ width: STROKE_WIDTH, pointerEvents: "auto" }}>
								<InkStrokeButton tone="blood" variant={1} onClick={() => leave()}>
									{t("quit.leave")}
								</InkStrokeButton>
							</motion.div>
						</InkDelayContext.Provider>
						<InkDelayContext.Provider value={{ enter: 0.54, exit: EXIT_STROKES[1] }}>
							<motion.div exit={rowExit(EXIT_STROKES[1])} style={{ width: STROKE_WIDTH, pointerEvents: "auto" }}>
								<InkStrokeButton variant={2} onClick={() => quitMenu.close()}>
									{t("quit.cancel")}
								</InkStrokeButton>
							</motion.div>
						</InkDelayContext.Provider>
					</div>
				</div>
			)}
		</AnimatePresence>
	);
};

/** A line of text settling in out of a soft blur after `delay`, and leaving the same way (quicker) after `exitDelay`. */
const rise = (delay: number, opacity = 1, exitDelay = 0) => ({
	initial: { opacity: 0, y: 8, filter: "blur(4px)" },
	animate: { opacity, y: 0, filter: "blur(0px)", transition: { delay, duration: 0.5, ease: EASE_OUT } },
	exit: { opacity: 0, y: -4, filter: "blur(4px)", transition: { delay: exitDelay, duration: EXIT_DURATION, ease: EASE_OUT } },
});

/** A button row leaving with its stroke: the label blurs out over the same span the ink lifts. */
const rowExit = (delay: number) => ({ opacity: 0, filter: "blur(4px)", transition: { delay, duration: EXIT_DURATION, ease: EASE_OUT } });
