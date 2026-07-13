import { useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { INTRO } from "../../../layout";
import { inkFrameBlend, inkFrameSrc, preloadInkFrames } from "../../../inkFrames";

const VARIANTS = ["stroke-1", "stroke-2", "stroke-3"] as const;

// Tones are SOLID ink; "ghost" dims via the wrapper's opacity instead of an rgba fill — the
// paint-on stacks two mask layers, and a translucent fill would double-darken their overlap.
const TONES = {
	ink: { color: "#17120e", opacity: 1 },
	red: { color: "#b73225", opacity: 1 },
	blue: { color: "#2f6f86", opacity: 1 },
	ghost: { color: "#17120e", opacity: 0.34 },
} as const;

for (const name of VARIANTS) preloadInkFrames(name, INTRO.paintFrames);

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

const MASK_LAYER: CSSProperties = {
	position: "absolute",
	inset: 0,
	WebkitMaskSize: "100% 100%",
	maskSize: "100% 100%",
};

/**
 * A floating sumi brush stroke that IS the button — and it is DRAWN, not revealed: a Motion
 * value 0→1 scrubs through 12 progressive mask frames (ragged, semi-transparent brush-tip
 * frontier baked in by scripts/ink_masks.py). Two stacked mask layers crossfade between
 * adjacent frames, and since frames are monotonic the fade only ever adds the fresh delta —
 * the stroke lays down continuously, flying white included.
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

	const name = VARIANTS[variant];
	const maskA = useTransform(progress, (v) => `url(${inkFrameSrc(name, inkFrameBlend(v, INTRO.paintFrames).a)})`);
	const maskB = useTransform(progress, (v) => `url(${inkFrameSrc(name, inkFrameBlend(v, INTRO.paintFrames).b)})`);
	const blend = useTransform(progress, (v) => inkFrameBlend(v, INTRO.paintFrames).blend);

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
			{/* Stroke group: opacity gates the un-drawn state (frame f01 is never empty) and
			    carries the ghost tone; the drop-shadow shades the composed group once. */}
			<motion.span
				variants={{
					hidden: { opacity: 0 },
					painted: { opacity: TONES[tone].opacity, transition: { duration: 0.1 } },
					bleed: { opacity: TONES[tone].opacity, scaleX: 1.04, scaleY: 1.08, transition: { duration: 0.25 } },
				}}
				style={{ position: "absolute", inset: 0, filter: "drop-shadow(0 6px 12px rgba(0, 0, 0, 0.35))" }}
			>
				<motion.span style={{ ...MASK_LAYER, background: TONES[tone].color, WebkitMaskImage: maskA, maskImage: maskA }} />
				<motion.span style={{ ...MASK_LAYER, background: TONES[tone].color, opacity: blend, WebkitMaskImage: maskB, maskImage: maskB }} />
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
