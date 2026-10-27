import type { CSSProperties } from "react";
import { motion } from "motion/react";
import { INK, PAPER_LIGHT, SEAL } from "../../../hudPalette";

export interface LifeSealProps {
	/** True once this life has been lost — the seal cracks in two and fades. */
	broken: boolean;
	/** Edge of the square seal, px. */
	size?: number;
	/** Slight hand-stamped tilt, degrees. */
	tilt?: number;
}

// The crack: a jagged line down the middle of the stone, top → bottom (% of the seal box).
const CRACK: [number, number][] = [
	[53, 0],
	[46, 17],
	[56, 33],
	[47, 51],
	[57, 67],
	[48, 84],
	[52, 100],
];
const pts = (p: [number, number][]) => p.map(([x, y]) => `${x}% ${y}%`).join(", ");
const LEFT_CLIP = `polygon(0% 0%, ${pts(CRACK)}, 0% 100%)`;
const RIGHT_CLIP = `polygon(100% 0%, 100% 100%, ${pts([...CRACK].reverse())})`;
const CRACK_PATH = `M ${CRACK.map(([x, y]) => `${x * 0.4} ${y * 0.4}`).join(" L ")}`;

/** Timing (s): the crack runs through the stone, then the halves part and the stamp drains. */
const CRACK_DUR = 0.2;
const SPLIT_DELAY = 0.16;

/**
 * One life, drawn as a vermilion hanko stamped with 命 (inochi, life). When it is lost the stone
 * CRACKS: a jagged fissure runs down its middle, the two halves part (each drifting and tipping
 * away from the crack) and the stamp drains to a pale ghost — the loss reads as a broken seal, not
 * a counter going down. `broken` is the only input: the change animates by itself.
 */
export const LifeSeal = ({ broken, size = 30, tilt = -4 }: LifeSealProps) => {
	const face: CSSProperties = {
		position: "absolute",
		inset: 0,
		display: "grid",
		placeItems: "center",
		background: SEAL,
		borderRadius: size * 0.14,
		// Double border of a carved seal: paper hairline inside the vermilion.
		boxShadow: `inset 0 0 0 ${Math.max(1.5, size * 0.07)}px ${SEAL}, inset 0 0 0 ${Math.max(2.5, size * 0.11)}px ${PAPER_LIGHT}`,
		color: PAPER_LIGHT,
		fontFamily: "var(--font-display)",
		fontSize: size * 0.56,
		lineHeight: 1,
	};
	const gap = size * 0.07;
	const half = (side: -1 | 1, clipPath: string) => (
		<motion.span
			initial={false}
			animate={
				broken
					? { x: side * gap, y: size * 0.03, rotate: side * 5, opacity: 0.3, filter: "grayscale(1)" }
					: { x: 0, y: 0, rotate: 0, opacity: 1, filter: "grayscale(0)" }
			}
			transition={
				broken
					? { default: { duration: 0.35, delay: SPLIT_DELAY, ease: [0.2, 0.9, 0.3, 1] }, opacity: { duration: 0.6, delay: SPLIT_DELAY + 0.15 }, filter: { duration: 0.6, delay: SPLIT_DELAY + 0.15 } }
					: { duration: 0.3 }
			}
			style={{ ...face, clipPath, WebkitClipPath: clipPath, // Each half pivots on its outer bottom corner, so its top tips away from the crack.
				transformOrigin: side < 0 ? "0% 100%" : "100% 100%" }}
		>
			命
		</motion.span>
	);

	return (
		<motion.span
			initial={false}
			animate={broken ? { rotate: [tilt, tilt + 7, tilt - 4, tilt + 1], scale: [1, 1.12, 0.97, 1] } : { rotate: tilt, scale: 1 }}
			transition={{ duration: 0.45, ease: "easeOut" }}
			style={{ position: "relative", display: "inline-block", width: size, height: size, flex: "none", filter: "drop-shadow(0 2px 2.5px rgba(0, 0, 0, 0.25))" }}
		>
			{half(-1, LEFT_CLIP)}
			{half(1, RIGHT_CLIP)}
			{/* The fissure: a thin ink line that runs through the stone just before it parts. */}
			<svg viewBox="0 0 40 40" style={{ position: "absolute", inset: 0, width: size, height: size, overflow: "visible", pointerEvents: "none" }}>
				<motion.path
					d={CRACK_PATH}
					fill="none"
					stroke={INK}
					strokeWidth={1.6}
					strokeLinejoin="round"
					strokeLinecap="round"
					initial={false}
					animate={broken ? { pathLength: 1, opacity: [0, 0.9, 0.9, 0] } : { pathLength: 0, opacity: 0 }}
					transition={broken ? { pathLength: { duration: CRACK_DUR, ease: "easeIn" }, opacity: { duration: SPLIT_DELAY + 0.3, times: [0, 0.1, 0.55, 1] } } : { duration: 0.2 }}
				/>
			</svg>
		</motion.span>
	);
};
