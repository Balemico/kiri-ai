import { motion } from "motion/react";
import { INK, PAPER_LIGHT, SEAL } from "../../../hudPalette";

export interface LifeSealProps {
	/** True once this life has been lost — the seal is cut through and fades. */
	broken: boolean;
	/** Edge of the square seal, px. */
	size?: number;
	/** Slight hand-stamped tilt, degrees. */
	tilt?: number;
}

/**
 * One life, drawn as a vermilion hanko stamped with 命 (inochi, life). When it is lost a sumi
 * slash is drawn across it and the stamp drains to a pale ghost — so the loss reads as a cut,
 * not just a counter going down. `broken` is the only input: the change animates by itself.
 */
export const LifeSeal = ({ broken, size = 30, tilt = -4 }: LifeSealProps) => (
	<motion.span
		initial={false}
		animate={broken ? { rotate: [tilt, tilt + 9, tilt - 6, tilt + 2], scale: [1, 1.18, 0.96, 1] } : { rotate: tilt, scale: 1 }}
		transition={{ duration: 0.5, ease: "easeOut" }}
		style={{ position: "relative", display: "inline-block", width: size, height: size, flex: "none" }}
	>
		<motion.span
			initial={false}
			animate={{ opacity: broken ? 0.22 : 1, filter: broken ? "grayscale(1)" : "grayscale(0)" }}
			transition={{ duration: 0.6, delay: broken ? 0.25 : 0 }}
			style={{
				position: "absolute",
				inset: 0,
				display: "grid",
				placeItems: "center",
				background: SEAL,
				borderRadius: size * 0.14,
				// Double border of a carved seal: paper hairline inside the vermilion.
				boxShadow: `inset 0 0 0 ${Math.max(1.5, size * 0.07)}px ${SEAL}, inset 0 0 0 ${Math.max(2.5, size * 0.11)}px ${PAPER_LIGHT}, 0 2px 5px rgba(0, 0, 0, 0.25)`,
				color: PAPER_LIGHT,
				fontFamily: "var(--font-display)",
				fontSize: size * 0.56,
				lineHeight: 1,
			}}
		>
			命
		</motion.span>
		{/* The cut: a tapered ink slash that draws across the seal. */}
		<svg viewBox="0 0 40 40" style={{ position: "absolute", inset: -size * 0.25, width: size * 1.5, height: size * 1.5, overflow: "visible", pointerEvents: "none" }}>
			<motion.path
				d="M4 33 C 14 24, 25 15, 37 6"
				fill="none"
				stroke={INK}
				strokeWidth={4.2}
				strokeLinecap="round"
				initial={false}
				animate={{ pathLength: broken ? 1 : 0, opacity: broken ? 0.9 : 0 }}
				transition={{ duration: 0.22, ease: [0.6, 0, 0.2, 1] }}
			/>
		</svg>
	</motion.span>
);
