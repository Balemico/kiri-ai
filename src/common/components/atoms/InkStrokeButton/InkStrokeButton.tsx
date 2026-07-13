import type { CSSProperties, ReactNode } from "react";
import { motion } from "motion/react";

const STROKES = ["/images/intro/stroke-1.png", "/images/intro/stroke-2.png", "/images/intro/stroke-3.png"];

const TONES = {
	ink: "#17120e",
	red: "#b73225",
	blue: "#2f6f86",
	ghost: "rgba(23, 18, 14, 0.34)",
} as const;

export interface InkStrokeButtonProps {
	children: ReactNode;
	onClick?: () => void;
	disabled?: boolean;
	tone?: keyof typeof TONES;
	/** Which brush texture (rotated variants keep siblings from looking cloned). */
	variant?: 0 | 1 | 2;
	/** Vermilion hanko dot at the stroke's end — the primary action's mark. */
	seal?: boolean;
	/** False = still hidden (intro choreography); flipping to true paints the stroke on NOW. */
	visible?: boolean;
	style?: CSSProperties;
}

/**
 * A floating sumi brush stroke that IS the button: the PNG is a mask over a colour fill, so
 * every tone shares the real brush silhouette. Paints on left→right (clip-path), and on hover
 * the ink "bleeds" — the stroke stretches a touch and the label's tracking opens.
 *
 * The paint-on is STATE-driven (`visible`), never delay-scheduled: the caller flips `visible`
 * when the choreography reaches this button's beat, switching the variant label
 * hidden → painted — a target-CHANGING label switch, which Motion animates immediately. A skip
 * that flips every beat at once therefore fast-forwards reliably (whereas a changed
 * `transition.delay` never restarts a pending Motion animation, and a same-target relabel is
 * ignored via `protectedKeys`). The small label/seal delays below are intra-element offsets only.
 */
export const InkStrokeButton = ({ children, onClick, disabled, tone = "ink", variant = 0, seal = false, visible = true, style }: InkStrokeButtonProps) => {
	const mask = `url(${STROKES[variant]})`;
	return (
		<motion.button
			type="button"
			disabled={disabled}
			onClick={onClick}
			initial="hidden"
			animate={visible ? "painted" : "hidden"}
			whileHover={disabled ? undefined : "bleed"}
			whileTap={disabled ? undefined : { scale: 0.97 }}
			style={{
				position: "relative",
				width: "100%",
				height: 70,
				padding: 0,
				background: "none",
				border: "none",
				cursor: disabled ? "default" : "pointer",
				...style,
				opacity: disabled ? 0.4 : 1,
			}}
		>
			<motion.span
				variants={{
					hidden: { clipPath: "inset(0 100% 0 0)" },
					painted: { clipPath: "inset(0 0% 0 0)", transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
					bleed: { clipPath: "inset(0 0% 0 0)", scaleX: 1.04, scaleY: 1.08, transition: { duration: 0.25 } },
				}}
				style={{
					position: "absolute",
					inset: 0,
					background: TONES[tone],
					WebkitMaskImage: mask,
					maskImage: mask,
					WebkitMaskSize: "100% 100%",
					maskSize: "100% 100%",
					filter: "drop-shadow(0 6px 12px rgba(0, 0, 0, 0.35))",
				}}
			/>
			<motion.span
				variants={{
					hidden: { opacity: 0 },
					painted: { opacity: 1, letterSpacing: "3px", transition: { delay: 0.15, duration: 0.35 } },
					bleed: { opacity: 1, letterSpacing: "4.5px", transition: { duration: 0.25 } },
				}}
				style={{
					position: "relative",
					color: "#f2ead9",
					fontSize: 16,
					fontWeight: 700,
					letterSpacing: 3,
					whiteSpace: "nowrap",
				}}
			>
				{children}
			</motion.span>
			{seal && (
				<motion.span
					variants={{
						hidden: { opacity: 0, scale: 0.4, rotate: -6 },
						painted: { opacity: 1, scale: 1, rotate: -6, transition: { delay: 0.3, duration: 0.3 } },
					}}
					style={{
						position: "absolute",
						// ON the stroke's tapering tail, not past the button box — the mask ends before the
						// box edge, so a negative offset reads as an orphaned floating square.
						right: 26,
						top: "50%",
						width: 18,
						height: 18,
						marginTop: -9,
						background: "#b73225",
						borderRadius: 4,
						boxShadow: "0 2px 6px rgba(0, 0, 0, 0.3)",
					}}
				/>
			)}
		</motion.button>
	);
};
