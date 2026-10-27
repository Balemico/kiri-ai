import { motion } from "motion/react";
import { PAPER_LIGHT } from "../../../hudPalette";
import { useSealDiscControls } from "../../../hooks/useSealDiscControls";

export interface SealDiscProps {
	/** The character carved on the seal. */
	kanji: string;
	/** Seal colour (the team ink). */
	colour: string;
	/** Edge of the disc, px — every bevel/shadow scales from it. */
	size: number;
	/** The disc breathes with a soft halo (this player is acting). */
	active?: boolean;
}

// Hand-cut outline: an uneven radius reads as a carved stone, not a CSS dot.
const DISC_RADIUS = "47% 53% 49% 51% / 52% 46% 54% 48%";

/**
 * The breathing halo as a box-shadow with EVERY keyframe in the same shape — px units on all four
 * lengths and an rgba() colour. Motion can only interpolate matching shapes: with "0 0 0 0 #rrggbb00"
 * at the ends it animated the swell but not the way back, holding at full size and then snapping off.
 */
const halo = (colour: string, spreadPx: number, alpha: number): string => {
	// Straight from the #rrggbb digits (sRGB) — three's Color would hand back LINEAR components.
	const n = parseInt(colour.replace("#", ""), 16);
	return `0px 0px 0px ${spreadPx.toFixed(2)}px rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

const tint = (colour: string, pct: number) => `color-mix(in srgb, ${colour}, white ${Math.round(pct * 100)}%)`;
const shade = (colour: string, pct: number) => `color-mix(in srgb, ${colour}, black ${Math.round(pct * 100)}%)`;

/**
 * A team seal, carved rather than printed. Three layers lit from the top-left:
 *  - the RIM, a bevel (light top-left → dark bottom-right) that reads as a raised lip;
 *  - the FACE, sunk inside it (inner shadow under the top-left lip, a catch-light on the far edge);
 *  - the KANJI, standing in relief (highlight on its upper edges, cast shadow below-right).
 * A faint specular sheen sits over the whole stone. All pure CSS — no assets.
 */
export const SealDisc = ({ kanji, colour, size, active = false }: SealDiscProps) => {
	const { rim, bevel, depth, relief, gloss } = useSealDiscControls();
	const rimPx = size * rim;
	const d = Math.max(1, size * 0.035) * depth;
	// Capped: on a big seal a wide offset reads as a mis-registered double outline, not relief.
	const r = Math.min(2, Math.max(0.6, size * 0.012)) * relief;
	return (
		<motion.div
			animate={
				active
					? { scale: [1, 1.05, 1], boxShadow: [halo(colour, 0, 0), halo(colour, size * 0.13, 0.18), halo(colour, 0, 0)] }
					: { scale: 1, boxShadow: halo(colour, 0, 0) }
			}
			transition={active ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
			style={{
				position: "relative",
				width: size,
				height: size,
				flex: "none",
				borderRadius: DISC_RADIUS,
				// Rim bevel: lit lip top-left, shadowed lip bottom-right, with a dark outer edge line.
				background: `linear-gradient(145deg, ${tint(colour, bevel)} 0%, ${colour} 42%, ${shade(colour, bevel)} 100%)`,
				// The stone sits ON the paper: a contact shadow plus a softer cast shadow.
				filter: `drop-shadow(0 ${size * 0.03}px ${size * 0.03}px rgba(0, 0, 0, 0.35)) drop-shadow(0 ${size * 0.08}px ${size * 0.12}px rgba(0, 0, 0, 0.22))`,
			}}
		>
			{/* Recessed face. */}
			<div
				style={{
					position: "absolute",
					inset: rimPx,
					display: "grid",
					placeItems: "center",
					borderRadius: DISC_RADIUS,
					background: `radial-gradient(circle at 38% 32%, ${tint(colour, 0.12)}, ${colour} 55%, ${shade(colour, 0.18)})`,
					boxShadow: `inset ${d}px ${d}px ${d * 1.6}px rgba(0, 0, 0, 0.45), inset ${-d * 0.6}px ${-d * 0.6}px ${d}px rgba(255, 255, 255, 0.25)`,
					color: PAPER_LIGHT,
					fontFamily: "var(--font-display)",
					fontSize: size * 0.5,
					lineHeight: 1,
					// Relief: catch-light on the strokes' upper-left edges, cast shadow down-right.
					textShadow: `${-r * 0.6}px ${-r * 0.6}px ${r * 0.6}px rgba(255, 255, 255, 0.45), ${r}px ${r * 1.3}px ${r * 1.2}px rgba(0, 0, 0, 0.45)`,
				}}
			>
				{kanji}
			</div>
			{/* Specular sheen over the whole stone. */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					borderRadius: DISC_RADIUS,
					background: `radial-gradient(ellipse 60% 45% at 30% 22%, rgba(255, 255, 255, ${gloss}), transparent 70%)`,
					pointerEvents: "none",
				}}
			/>
		</motion.div>
	);
};
