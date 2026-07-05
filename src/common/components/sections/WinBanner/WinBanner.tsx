import { motion, type Variants } from "motion/react";
import { typographyVariants } from "../../atoms/Typography/typographyVariants";
import { useGame } from "../../../state";
import { useWinBannerControls } from "../../../hooks/useWinBannerControls";

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
	const chars = [...`${team} wins`];

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
			</div>
		</div>
	);
};
