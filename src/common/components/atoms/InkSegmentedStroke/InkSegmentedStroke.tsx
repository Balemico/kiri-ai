import { useContext, useEffect, useRef, useState } from "react";
import { motion, useIsPresent } from "motion/react";
import { inkStrokes, INK_TONE_FALLBACK, inkSupported, newInkStrokeId, type InkTone } from "../../../ink/inkRegistry";
import { INK, INK_LABEL_SHIFT } from "../../../layout";
import { InkDelayContext } from "../../../ink/inkDelay";

export interface InkSegmentOption {
	label: string;
	/** Tone the stroke's half takes while this option is selected. */
	tone: InkTone;
}

export interface InkSegmentedStrokeProps {
	/** Exactly two options: left half, right half. */
	options: [InkSegmentOption, InkSegmentOption];
	value: 0 | 1;
	onChange: (value: 0 | 1) => void;
	variant?: number;
	visible?: boolean;
	/** Box height (px) — the stroke is drawn to fit it. */
	height?: number;
	/** Label size (px). */
	fontSize?: number;
	/** Label tracking once painted (px). */
	letterSpacing?: number;
}

/**
 * A two-option toggle drawn as ONE sumi stroke (same brush as `InkStrokeButton`): the selected
 * half carries its colour, the other half fades to ghost-grey, and on change the colour glides
 * across the seam. Each half is a real button over its side of the stroke (labels stay DOM).
 */
export const InkSegmentedStroke = ({ options, value, onChange, variant = 0, visible = true, height = 70, fontSize = 16, letterSpacing = 3 }: InkSegmentedStrokeProps) => {
	const ref = useRef<HTMLDivElement>(null);
	const [id] = useState(newInkStrokeId);
	const [hovered, setHovered] = useState(false);
	const ink = inkSupported();
	const { enter: delay, exit: exitDelay } = useContext(InkDelayContext);
	// Leaving (inside an AnimatePresence exit): the ink lifts away instead of vanishing.
	const leaving = !useIsPresent();

	useEffect(() => {
		if (!ink || !ref.current) return;
		inkStrokes.upsert({
			id,
			el: ref.current,
			tone: "ink",
			variant,
			visible,
			hovered,
			disabled: false,
			delay,
			leaving,
			exitDelay,
			segment: { left: options[0].tone, right: options[1].tone, active: value },
		});
	}, [ink, id, variant, visible, hovered, value, options, delay, leaving, exitDelay]);
	useEffect(() => () => inkStrokes.remove(id), [id]);

	return (
		<motion.div
			ref={ref}
			role="radiogroup"
			onHoverStart={() => setHovered(true)}
			onHoverEnd={() => setHovered(false)}
			initial="hidden"
			animate={visible ? "painted" : "hidden"}
			style={{ position: "relative", display: "flex", width: "100%", height }}
		>
			{options.map((o, i) => {
				const selected = value === i;
				return (
					<motion.button
						key={o.label}
						type="button"
						role="radio"
						aria-checked={selected}
						onClick={() => onChange(i as 0 | 1)}
						whileTap={{ scale: 0.97 }}
						style={{
							position: "relative",
							flex: 1,
							padding: 0,
							background: !ink ? (selected ? INK_TONE_FALLBACK[o.tone] : INK_TONE_FALLBACK.ghost) : "none",
							border: "none",
							borderRadius: !ink ? (i === 0 ? "40% 0 0 40% / 50% 0 0 50%" : "0 40% 40% 0 / 0 50% 50% 0") : undefined,
							margin: !ink ? "10px 0" : undefined,
							cursor: selected ? "default" : "pointer",
							// The unselected label recedes with its half (a CSS transition — a Motion
							// `animate` on the label would cut it off from the parent's paint-on variants).
							opacity: selected ? 1 : 0.72,
							transition: "opacity 0.35s ease",
						}}
					>
						<motion.span
							variants={{
								hidden: { opacity: 0, letterSpacing: `${letterSpacing * 2}px`, filter: "blur(3px)" },
								painted: { opacity: 1, letterSpacing: `${letterSpacing}px`, filter: "blur(0px)", transition: { delay: delay + INK.strokePour * 0.45, duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
							}}
							// `top`: optical centring of the capitals on the stroke (INK_LABEL_SHIFT).
							style={{ position: "relative", top: INK_LABEL_SHIFT, color: "#f2ead9", fontSize, fontWeight: 700, letterSpacing, whiteSpace: "nowrap" }}
						>
							{o.label}
						</motion.span>
					</motion.button>
				);
			})}
		</motion.div>
	);
};
