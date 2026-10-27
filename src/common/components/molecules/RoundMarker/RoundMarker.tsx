import { useId } from "react";
import { AnimatePresence, motion } from "motion/react";
import { INK, kanjiNumeral } from "../../../hudPalette";

export interface RoundMarkerProps {
	round: number;
	/** One-line phase caption under the numeral; null hides it. */
	caption?: string | null;
	scale?: number;
}

/**
 * The round number as a kanji numeral (一, 二, 三…) inside an ensō — the open zen brush circle.
 * Each new round re-draws the circle and stamps the numeral in, so the round change is felt.
 */
export const RoundMarker = ({ round, caption, scale = 1 }: RoundMarkerProps) => {
	const filterId = useId().replace(/:/g, "");
	const size = 76 * scale;
	return (
		<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 * scale, color: INK }}>
			<span style={{ fontSize: 10 * scale, letterSpacing: "0.32em", opacity: 0.6, paddingLeft: "0.32em" }}>ROUND</span>
			<div style={{ position: "relative", width: size, height: size }}>
				<svg viewBox="0 0 100 100" width={size} height={size} style={{ position: "absolute", inset: 0, overflow: "visible" }} aria-hidden>
					<defs>
						<filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
							<feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="7" />
							<feDisplacementMap in="SourceGraphic" scale="4" />
						</filter>
					</defs>
					{/* Keyed by round: a fresh circle is brushed on every round. Starts bottom-left and
					    stops short of closing — the gap is what makes it an ensō. */}
					<motion.path
						key={round}
						d="M30 82 A 40 40 0 1 1 64 87"
						fill="none"
						stroke={INK}
						strokeWidth={5.5}
						strokeLinecap="round"
						filter={`url(#${filterId})`}
						initial={{ pathLength: 0, opacity: 0.85 }}
						animate={{ pathLength: 1, opacity: 0.85 }}
						transition={{ duration: 0.9, ease: [0.45, 0, 0.2, 1] }}
					/>
				</svg>
				<AnimatePresence mode="popLayout" initial={false}>
					<motion.span
						key={round}
						initial={{ opacity: 0, scale: 1.5 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.8 }}
						transition={{ duration: 0.45, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
						style={{
							position: "absolute",
							inset: 0,
							display: "grid",
							placeItems: "center",
							fontFamily: "var(--font-display)",
							fontSize: size * (round >= 10 ? 0.36 : 0.46),
							lineHeight: 1,
						}}
					>
						{kanjiNumeral(round)}
					</motion.span>
				</AnimatePresence>
			</div>
			<div style={{ height: 16 * scale }}>
				<AnimatePresence mode="wait">
					{caption && (
						<motion.span
							key={caption}
							initial={{ opacity: 0, y: -4 }}
							animate={{ opacity: 0.7, y: 0 }}
							exit={{ opacity: 0, y: 4 }}
							transition={{ duration: 0.3 }}
							style={{ display: "block", fontSize: 11 * scale, letterSpacing: "0.22em", whiteSpace: "nowrap" }}
						>
							{caption}
						</motion.span>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
};
