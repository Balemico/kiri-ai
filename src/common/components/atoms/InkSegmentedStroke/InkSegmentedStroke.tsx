import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { inkStrokes, inkSupported, newInkStrokeId, type InkTone } from "../../../ink/inkRegistry";
import { INK } from "../../../layout";

// CSS stand-in used only where the ink canvas can't run (no WebGPU and no WebGL2).
const FALLBACK: Record<InkTone, string> = { ink: "#17120e", red: "#b73225", blue: "#2f6f86", ghost: "rgba(23, 18, 14, 0.34)" };

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
}

/**
 * A two-option toggle drawn as ONE sumi stroke (same brush as `InkStrokeButton`): the selected
 * half carries its colour, the other half fades to ghost-grey, and on change the colour glides
 * across the seam. Each half is a real button over its side of the stroke (labels stay DOM).
 */
export const InkSegmentedStroke = ({ options, value, onChange, variant = 0, visible = true }: InkSegmentedStrokeProps) => {
	const ref = useRef<HTMLDivElement>(null);
	const [id] = useState(newInkStrokeId);
	const [hovered, setHovered] = useState(false);
	const ink = inkSupported();

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
			segment: { left: options[0].tone, right: options[1].tone, active: value },
		});
	}, [ink, id, variant, visible, hovered, value, options]);
	useEffect(() => () => inkStrokes.remove(id), [id]);

	return (
		<motion.div
			ref={ref}
			role="radiogroup"
			onHoverStart={() => setHovered(true)}
			onHoverEnd={() => setHovered(false)}
			initial="hidden"
			animate={visible ? "painted" : "hidden"}
			style={{ position: "relative", display: "flex", width: "100%", height: 70 }}
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
							background: !ink ? (selected ? FALLBACK[o.tone] : FALLBACK.ghost) : "none",
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
								hidden: { opacity: 0, letterSpacing: "6px", filter: "blur(3px)" },
								painted: { opacity: 1, letterSpacing: "3px", filter: "blur(0px)", transition: { delay: INK.strokePour * 0.45, duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
							}}
							style={{ position: "relative", color: "#f2ead9", fontSize: 16, fontWeight: 700, letterSpacing: 3, whiteSpace: "nowrap" }}
						>
							{o.label}
						</motion.span>
					</motion.button>
				);
			})}
		</motion.div>
	);
};
