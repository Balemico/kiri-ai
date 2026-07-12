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
	/** Seconds before the stroke paints itself on (intro choreography; 0 = already painted). */
	delay?: number;
	style?: CSSProperties;
}

/**
 * A floating sumi brush stroke that IS the button: the PNG is a mask over a colour fill, so
 * every tone shares the real brush silhouette. Paints on left→right (clip-path), and on hover
 * the ink "bleeds" — the stroke stretches a touch and the label's tracking opens.
 */
export const InkStrokeButton = ({ children, onClick, disabled, tone = "ink", variant = 0, seal = false, delay = 0, style }: InkStrokeButtonProps) => {
	const mask = `url(${STROKES[variant]})`;
	return (
		<motion.button
			type="button"
			disabled={disabled}
			onClick={onClick}
			initial="hidden"
			animate="painted"
			whileHover={disabled ? undefined : "bleed"}
			whileTap={disabled ? undefined : { scale: 0.97 }}
			style={{
				position: "relative",
				width: "100%",
				height: 58,
				padding: 0,
				background: "none",
				border: "none",
				cursor: disabled ? "default" : "pointer",
				opacity: disabled ? 0.4 : 1,
				...style,
			}}
		>
			<motion.span
				variants={{
					hidden: { clipPath: "inset(0 100% 0 0)" },
					painted: { clipPath: "inset(0 0% 0 0)", transition: { delay, duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
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
					painted: { opacity: 1, letterSpacing: "3px", transition: { delay: delay + 0.25, duration: 0.35 } },
					bleed: { opacity: 1, letterSpacing: "4.5px", transition: { duration: 0.25 } },
				}}
				style={{
					position: "relative",
					color: "#f2ead9",
					fontSize: 15,
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
						hidden: { opacity: 0, scale: 0.4 },
						painted: { opacity: 1, scale: 1, transition: { delay: delay + 0.45, duration: 0.3 } },
					}}
					style={{
						position: "absolute",
						right: -6,
						top: "50%",
						width: 16,
						height: 16,
						marginTop: -8,
						background: "#b73225",
						borderRadius: 4,
						transform: "rotate(-6deg)",
						boxShadow: "0 2px 6px rgba(0, 0, 0, 0.3)",
					}}
				/>
			)}
		</motion.button>
	);
};
