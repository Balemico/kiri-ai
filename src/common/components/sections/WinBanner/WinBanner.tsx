import { motion, type Variants } from "motion/react";
import { typographyVariants } from "../../atoms/Typography/typographyVariants";
import { InkStrokeLabel, SealDisc } from "../../atoms";
import { useGame } from "../../../state";
import { useWinBannerControls } from "../../../hooks/useWinBannerControls";
import { useIsPortrait } from "../../../hooks/useIsPortrait";
import { useVictoryShown } from "../../../state/victoryReveal";
import { INK, PAPER_LIGHT, SEAL, TEAM_INK, TEAM_KANJI, TEAM_NAME } from "../../../hudPalette";
import { MAX_HITS, type Stance } from "../../../game";
import { characterImagePath } from "../../../hooks/useCharacterTextures";
import { PAWN } from "../../../layout";

// NOTE: the sumi-e brush-stroke background (atoms/InkBrush) is temporarily disabled — we'll
// revisit the look later. To re-enable: restore the `InkBrush` import + the text-measuring
// `useLayoutEffect` and render `<InkBrush ... />` behind the words (see git history).

/** Big centered victory title, revealed letter by letter. */
export const WinBanner = () => {
	const { state } = useGame();
	const { testVictory, testTeam, offsetTop, fontScale, letterStagger, letterDuration } = useWinBannerControls();
	const portrait = useIsPortrait();
	// A real win waits for its closing beat: the blow lands, the loser falls, THEN the screen comes in.
	const revealed = useVictoryShown();

	// Real winner takes priority; the Leva toggle previews the banner without a win.
	const winner = state.winner ? (revealed ? state.winner : null) : testVictory ? testTeam : null;
	if (!winner) return null;

	if (portrait) {
		return (
			<PortraitVictory
				key={`${winner}-${letterStagger}-${letterDuration}`}
				team={winner}
				stance={state[winner].stance}
				rounds={state.round}
				lives={MAX_HITS - state[winner].damage}
				letterStagger={letterStagger}
				letterDuration={letterDuration}
			/>
		);
	}

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

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
/** A heavy stamp: overshoots past flat, then settles. */
const STAMP_EASE = [0.5, 0, 0.3, 1.35] as const;

interface PortraitVictoryProps {
	team: "red" | "blue";
	/** The winner's stance at the end — picks its silhouette (high = heaven, low = earth). */
	stance: Stance;
	rounds: number;
	lives: number;
	letterStagger: number;
	letterDuration: number;
}

/** The samurai's own colours (match Pawn's silhouette tint). */
const FIGURE_COLOR: Record<"red" | "blue", string> = { red: "#cf463f", blue: "#4a8aa0" };

/** The paper cut-out look of the in-game samurai, in CSS: a white paper rim (zero-blur outlines) and
 *  the sheet's dark offset edge. */
const CUTOUT_FILTER = [
	"drop-shadow(2px 0 0 #fff)",
	"drop-shadow(-2px 0 0 #fff)",
	"drop-shadow(0 2px 0 #fff)",
	"drop-shadow(0 -2px 0 #fff)",
	"drop-shadow(3px 3px 0 rgba(0, 0, 0, 0.28))",
].join(" ");

/**
 * Portrait victory: the board recedes under a washi veil; the winner's 赤/青 seal is stamped behind
 * the stage like a rising sun (with a ripple of team ink), the winner's samurai is raised in front of
 * it like a paper-theatre figure, the title writes itself in white on a team-coloured sumi stroke,
 * 一本 is stamped on the seal's edge, and a short tally closes it. The veil sits UNDER the duel's ink
 * layer (1450) so the title's stroke and the NUOVA PARTITA button stay on top of it.
 */
const PortraitVictory = ({ team, stance, rounds, lives, letterStagger, letterDuration }: PortraitVictoryProps) => {
	const colour = TEAM_INK[team];
	// Sized in px from the window (SealDisc sizes its bevels in px; the screen is transient, read once).
	const stage = Math.round(Math.min(window.innerHeight * 0.42, window.innerWidth * 0.95, 380));
	const disc = Math.round(stage * 0.56);
	// The winner's silhouette in its final stance, at its native aspect.
	const figureUrl = characterImagePath(team, stance);
	const frame = stance === "heaven" ? PAWN.frames.heaven : PAWN.frames.earth;
	const figureH = Math.round(stage * 0.88);
	const figureW = Math.min(stage, Math.round(figureH * frame.aspect));
	const chars = [...`vince il ${TEAM_NAME[team].toLowerCase()}`];
	// Beats (s): veil → seal stamp → samurai raised → stroke + letters → 一本 → tally.
	const sealAt = 0.35;
	const standAt = sealAt + 0.3;
	const titleAt = standAt + 0.8;
	const ipponAt = titleAt + letterStagger * chars.length + letterDuration;
	const tallyAt = ipponAt + 0.45;

	const container: Variants = { hidden: {}, show: { transition: { delayChildren: titleAt, staggerChildren: letterStagger } } };
	const letter: Variants = {
		hidden: { opacity: 0, y: 10, filter: "blur(8px)" },
		show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: letterDuration, ease: EASE_OUT } },
	};

	return (
		<>
			{/* Washi veil: the board stays a faint presence behind the result, never competes with it. */}
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.8, ease: EASE_OUT }}
				style={{
					position: "fixed",
					inset: 0,
					zIndex: 1400,
					pointerEvents: "none",
					background: "radial-gradient(ellipse 90% 60% at 50% 40%, rgba(244, 238, 224, 0.96) 0%, rgba(244, 238, 224, 0.9) 55%, rgba(244, 238, 224, 0.72) 100%)",
				}}
			/>
			<div
				style={{
					position: "fixed",
					inset: 0,
					zIndex: 2000,
					pointerEvents: "none",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					// Clear of the NUOVA PARTITA button at the bottom.
					paddingBottom: "16vh",
					gap: "clamp(12px, 2.5vh, 24px)",
				}}
			>
				<div style={{ position: "relative", width: stage, height: stage }}>
					{/* The winner's seal — the sun behind the figure — slammed down; a ring of ink spreads on impact. */}
					<div style={{ position: "absolute", top: 0, left: stage * 0.36, width: disc, height: disc }}>
						<motion.div
							initial={{ opacity: 0.7, scale: 0.9 }}
							animate={{ opacity: 0, scale: 1.9 }}
							transition={{ delay: sealAt + 0.3, duration: 0.9, ease: EASE_OUT }}
							style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `3px solid ${colour}` }}
						/>
						<motion.div
							initial={{ opacity: 0, scale: 2.4, rotate: -10 }}
							animate={{ opacity: 1, scale: 1, rotate: 0 }}
							transition={{ delay: sealAt, duration: 0.38, ease: STAMP_EASE }}
							style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}
						>
							<SealDisc kanji={TEAM_KANJI[team]} colour={colour} size={disc} />
						</motion.div>
						{/* 一本 (ippon) — the decisive blow, stamped on the seal's right edge. */}
						<motion.div
							initial={{ opacity: 0, scale: 2.2, rotate: -16 }}
							animate={{ opacity: 1, scale: 1, rotate: -8 }}
							transition={{ delay: ipponAt, duration: 0.32, ease: STAMP_EASE }}
							style={{
								position: "absolute",
								right: "-14%",
								bottom: "-6%",
								zIndex: 2,
								padding: "clamp(5px, 1vmin, 10px) clamp(7px, 1.3vmin, 12px)",
								background: SEAL,
								color: PAPER_LIGHT,
								borderRadius: 6,
								boxShadow: `inset 0 0 0 3px ${SEAL}, inset 0 0 0 5px ${PAPER_LIGHT}, 0 8px 22px rgba(0, 0, 0, 0.3)`,
								fontFamily: "var(--font-display)",
								fontSize: "clamp(22px, 6.5vw, 40px)",
								lineHeight: 1.05,
								writingMode: "vertical-rl",
								letterSpacing: "0.05em",
							}}
						>
							一本
						</motion.div>
					</div>

					{/* Contact shadow, fading in as the figure stands. */}
					<motion.div
						initial={{ opacity: 0, scaleX: 0.4 }}
						animate={{ opacity: 0.35, scaleX: 1 }}
						transition={{ delay: standAt + 0.2, duration: 0.8, ease: EASE_OUT }}
						style={{
							position: "absolute",
							// Under the figure's legs (its measured body column), not the box centre.
							left: (stage - figureW) / 2 + figureW * frame.bodyCol - stage * 0.3,
							width: stage * 0.6,
							bottom: -stage * 0.02,
							height: stage * 0.06,
							borderRadius: "50%",
							background: "radial-gradient(ellipse at center, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0) 70%)",
						}}
					/>
					{/* The winner, raised like a paper-theatre figure: hinged at the feet, lying back, lifted upright. */}
					<motion.div
						initial={{ rotateX: 80, opacity: 0 }}
						animate={{ rotateX: 0, opacity: 1 }}
						transition={{ delay: standAt, duration: 1, ease: [0.25, 1.3, 0.4, 1], opacity: { delay: standAt, duration: 0.25 } }}
						style={{
							position: "absolute",
							left: (stage - figureW) / 2,
							bottom: 0,
							width: figureW,
							height: figureH,
							transformOrigin: "50% 100%",
							transformPerspective: 700,
							filter: CUTOUT_FILTER,
							zIndex: 1,
						}}
					>
						{/* The PNG is a white silhouette (tinted by the material in 3D): flood it with the team
						    colour through its own alpha — an SVG filter, which every browser (Safari included)
						    renders reliably, unlike a CSS mask under a filtered parent. */}
						<svg width="100%" height="100%" viewBox={`0 0 ${figureW} ${figureH}`} style={{ display: "block", overflow: "visible" }}>
							<defs>
								<filter id={`win-tint-${team}`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
									<feFlood floodColor={FIGURE_COLOR[team]} />
									<feComposite in2="SourceAlpha" operator="in" />
								</filter>
							</defs>
							<image href={figureUrl} width={figureW} height={figureH} preserveAspectRatio="xMidYMax meet" filter={`url(#win-tint-${team})`} />
						</svg>
					</motion.div>
				</div>

				{/* Title: white letters writing themselves on a team-coloured sumi stroke. */}
				<InkStrokeLabel tone={team} variant={team === "red" ? 1 : 2} delay={titleAt - 0.15} style={{ padding: "0.55em 1.6em 0.35em" }}>
					<motion.span
						variants={container}
						initial="hidden"
						animate="show"
						style={{ display: "inline-block", fontFamily: "var(--font-display)", fontSize: "clamp(26px, 9vw, 52px)", lineHeight: 1, whiteSpace: "nowrap", letterSpacing: "0.04em" }}
					>
						{chars.map((c, i) => (
							<motion.span key={i} variants={letter} style={{ display: "inline-block", width: c === " " ? "0.35em" : undefined }}>
								{c === " " ? "" : c}
							</motion.span>
						))}
					</motion.span>
				</InkStrokeLabel>

				{/* Tally: how the duel was won. */}
				<motion.p
					initial={{ opacity: 0, y: 6 }}
					animate={{ opacity: 0.7, y: 0 }}
					transition={{ delay: tallyAt, duration: 0.5, ease: EASE_OUT }}
					style={{ margin: 0, color: INK, fontSize: "clamp(12px, 3.6vw, 16px)", letterSpacing: "0.18em", textTransform: "uppercase" }}
				>
					in {rounds} round · {lives === 1 ? "1 vita rimasta" : `${lives} vite rimaste`}
				</motion.p>
			</div>
		</>
	);
};

