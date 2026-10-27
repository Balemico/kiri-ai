import { motion, type Variants } from "motion/react";
import { typographyVariants } from "../../atoms/Typography/typographyVariants";
import { useGame } from "../../../state";
import { useWinBannerControls } from "../../../hooks/useWinBannerControls";
import { PAPER_LIGHT, SEAL, TEAM_NAME } from "../../../hudPalette";

// NOTE: the sumi-e brush-stroke background (atoms/InkBrush) is temporarily disabled — we'll
// revisit the look later. To re-enable: restore the `InkBrush` import + the text-measuring
// `useLayoutEffect` and render `<InkBrush ... />` behind the words (see git history).

/** Big centered victory title, revealed letter by letter. */
export const WinBanner = () => {
	const { state } = useGame();
	const { testVictory, testTeam, offsetTop, fontScale, letterStagger, letterDuration } = useWinBannerControls();

	// Real winner takes priority; the Leva toggle previews the banner without a win.
	const winner = state.winner ?? (testVictory ? testTeam : null);
	if (!winner) return null;

	return (
		<Banner
			key={`${winner}-${offsetTop}-${fontScale}-${letterStagger}-${letterDuration}`}
			team={winner}
			offsetTop={offsetTop}
			fontScale={fontScale}
			letterStagger={letterStagger}
			letterDuration={letterDuration}
		/>
	);
};

interface BannerProps {
	team: "red" | "blue";
	offsetTop: number;
	fontScale: number;
	letterStagger: number;
	letterDuration: number;
}

/** Keyed remount per win so the letter reveal replays from the start. */
const Banner = ({ team, offsetTop, fontScale, letterStagger, letterDuration }: BannerProps) => {
	// Fluid: the title size tracks the window width (vw), scaled by the Leva multiplier — no
	// px cap, so it stays proportional to the window at any size.
	const fontSize = `${(12 * fontScale).toFixed(2)}vw`;
	const titleClass = typographyVariants({ variant: "display", color: team });
	// One span per character so each letter staggers in (the space is a fixed-width gap, since the
	// brush font's space glyph is nearly zero-width).
	const chars = [...`vince il ${TEAM_NAME[team].toLowerCase()}`];
	// The ippon seal stamps down once the title has finished writing itself.
	const stampDelay = letterStagger * chars.length + letterDuration;

	// staggerChildren = the gap between letters STARTING. It is independent of each letter's
	// duration, so when letterStagger < letterDuration the next letter begins while the current
	// one is still animating (they overlap).
	const container: Variants = {
		hidden: {},
		show: { transition: { staggerChildren: letterStagger } },
	};
	const letter: Variants = {
		hidden: { opacity: 0, x: 15, filter: "blur(10px)" },
		show: { opacity: 1, x: 0, filter: "blur(0px)", transition: { duration: letterDuration, ease: [0.22, 1, 0.36, 1] } },
	};

	return (
		<div style={{ position: "fixed", inset: 0, zIndex: 2000, pointerEvents: "none" }}>
			{/* Brush stroke background temporarily disabled — see note at top of file. */}
			<div
				style={{
					position: "absolute",
					top: `${(offsetTop * 100).toFixed(1)}vh`,
					left: "50%",
					transform: "translateX(-50%)",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
				}}
			>
				<motion.div
					variants={container}
					initial="hidden"
					animate="show"
					className={titleClass}
					style={{ fontSize, lineHeight: 1, whiteSpace: "nowrap" }}
				>
					{chars.map((c, i) => (
						<motion.span key={i} variants={letter} style={{ display: "inline-block", width: c === " " ? "0.35em" : undefined }}>
							{c === " " ? "" : c}
						</motion.span>
					))}
				</motion.div>
				{/* 一本 (ippon) — the decisive blow, slammed down as a vermilion seal. */}
				<motion.div
					initial={{ opacity: 0, scale: 2.2, rotate: -14 }}
					animate={{ opacity: 1, scale: 1, rotate: -5 }}
					transition={{ delay: stampDelay, duration: 0.32, ease: [0.5, 0, 0.3, 1.35] }}
					style={{
						marginTop: "clamp(10px, 2vh, 24px)",
						padding: "clamp(6px, 1vmin, 12px) clamp(8px, 1.3vmin, 14px)",
						background: SEAL,
						color: PAPER_LIGHT,
						borderRadius: 6,
						boxShadow: `inset 0 0 0 3px ${SEAL}, inset 0 0 0 5px ${PAPER_LIGHT}, 0 8px 22px rgba(0, 0, 0, 0.3)`,
						fontFamily: "var(--font-display)",
						fontSize: "clamp(30px, 6vmin, 64px)",
						lineHeight: 1.05,
						writingMode: "vertical-rl",
						letterSpacing: "0.05em",
					}}
				>
					一本
				</motion.div>
			</div>
		</div>
	);
};
