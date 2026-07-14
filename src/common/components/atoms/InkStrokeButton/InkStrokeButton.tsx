import { useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { INTRO } from "../../../layout";
import { WIPE_LEFT, WIPE_WIDTH, inkWipeSrc, preloadInk, wipeTravel } from "../../../inkWipe";

const VARIANTS = ["stroke-1", "stroke-2", "stroke-3"] as const;

// Tones are SOLID ink; "ghost" dims via the wrapper's opacity instead of an rgba fill, so the
// fill layer can stay opaque whatever slides over it.
const TONES = {
	ink: { color: "#17120e", opacity: 1 },
	red: { color: "#b73225", opacity: 1 },
	blue: { color: "#2f6f86", opacity: 1 },
	ghost: { color: "#17120e", opacity: 0.34 },
} as const;

preloadInk([...VARIANTS.map((n) => `/images/intro/${n}.png`), ...VARIANTS.map((_, i) => inkWipeSrc(i))]);

export interface InkStrokeButtonProps {
	children: ReactNode;
	onClick?: () => void;
	disabled?: boolean;
	tone?: keyof typeof TONES;
	/** Which brush texture (rotated variants keep siblings from looking cloned). */
	variant?: 0 | 1 | 2;
	/** Vermilion hanko dot at the stroke's end — the primary action's mark. */
	seal?: boolean;
	/** False = still hidden (intro choreography); flipping to true draws the stroke NOW. */
	visible?: boolean;
	style?: CSSProperties;
}

/**
 * A floating sumi brush stroke that IS the button — and it is DRAWN, not revealed: the stroke
 * mask stays static while an ink fill, masked by a ragged wipe ramp (`inkWipe.ts`), slides
 * underneath on a Motion value. The frontier moves continuously (compositor-only transform),
 * so the lay-down is fluid — no frame steps, no crossfade flicker.
 *
 * The paint-on stays STATE-driven (`visible`), never delay-scheduled: flipping `visible`
 * (re)starts the progress tween immediately, so an intro skip that flips every beat at once
 * fast-forwards reliably (a changed `transition.delay` would never restart a pending Motion
 * animation). Label/seal keep the variant choreography keyed off the same `visible`.
 */
export const InkStrokeButton = ({ children, onClick, disabled, tone = "ink", variant = 0, seal = false, visible = true, style }: InkStrokeButtonProps) => {
	const progress = useMotionValue(0);
	useEffect(() => {
		if (!visible) {
			progress.set(0);
			return;
		}
		const ctrl = animate(progress, 1, { duration: INTRO.strokePaint, ease: [0.22, 1, 0.36, 1] });
		return () => ctrl.stop();
	}, [visible, progress]);

	const x = useTransform(progress, wipeTravel);
	const name = VARIANTS[variant];

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
			{/* Stroke group: carries the ghost tone and the drop-shadow of the composed stroke. */}
			<motion.span
				variants={{
					hidden: { opacity: 0 },
					painted: { opacity: TONES[tone].opacity, transition: { duration: 0.1 } },
					bleed: { opacity: TONES[tone].opacity, scaleX: 1.04, scaleY: 1.08, transition: { duration: 0.25 } },
				}}
				style={{ position: "absolute", inset: 0, filter: "drop-shadow(0 6px 12px rgba(0, 0, 0, 0.35))" }}
			>
				{/* Static stroke silhouette; the sliding wipe fill paints it in. */}
				<span
					style={{
						position: "absolute",
						inset: 0,
						overflow: "hidden",
						WebkitMaskImage: `url(/images/intro/${name}.png)`,
						maskImage: `url(/images/intro/${name}.png)`,
						WebkitMaskSize: "100% 100%",
						maskSize: "100% 100%",
					}}
				>
					<motion.span
						style={{
							position: "absolute",
							top: 0,
							bottom: 0,
							left: WIPE_LEFT,
							width: WIPE_WIDTH,
							background: TONES[tone].color,
							WebkitMaskImage: `url(${inkWipeSrc(variant)})`,
							maskImage: `url(${inkWipeSrc(variant)})`,
							WebkitMaskSize: "100% 100%",
							maskSize: "100% 100%",
							x,
						}}
					/>
				</span>
			</motion.span>
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
