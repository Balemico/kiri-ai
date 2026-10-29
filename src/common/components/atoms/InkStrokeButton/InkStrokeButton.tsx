import { useContext, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { motion, useIsPresent } from "motion/react";
import { inkStrokes, INK_TONE_FALLBACK, inkSupported, newInkStrokeId, type InkTone } from "../../../ink/inkRegistry";
import { INK, INK_LABEL_SHIFT } from "../../../layout";
import { InkDelayContext } from "../../../ink/inkDelay";

export interface InkStrokeButtonProps {
	children: ReactNode;
	onClick?: () => void;
	disabled?: boolean;
	tone?: InkTone;
	/** Which brush (also seeds the stroke's shape) — siblings never look cloned. */
	variant?: 0 | 1 | 2;
	/** False = still hidden (intro choreography); flipping to true lays the stroke NOW. */
	visible?: boolean;
	style?: CSSProperties;
	/** Downward nudge that optically centres the label on the stroke. Defaults to the text value
	 *  (INK_LABEL_SHIFT, from the label font's metrics); an icon label has none of those — pass 0. */
	labelShift?: string | number;
}

/**
 * A menu button whose body is a living sumi stroke. The ink itself is drawn by the lobby's
 * `InkLayer` (TSL shader on its own canvas, under the menu column): this button only REGISTERS
 * its element + state, and keeps the label in the DOM on top. `visible` stays the
 * state-driven trigger of the choreography (an intro skip flips every beat at once and each
 * stroke starts pouring that frame).
 */
export const InkStrokeButton = ({ children, onClick, disabled, tone = "ink", variant = 0, visible = true, style, labelShift = INK_LABEL_SHIFT }: InkStrokeButtonProps) => {
	const ref = useRef<HTMLButtonElement>(null);
	const [id] = useState(newInkStrokeId);
	const [hovered, setHovered] = useState(false);
	const ink = inkSupported();
	// Row stagger (from an enclosing `Stagger`): the stroke and its label wait for the row.
	const { enter: delay, exit: exitDelay } = useContext(InkDelayContext);
	// Leaving (inside an AnimatePresence exit): the ink lifts away instead of vanishing.
	const leaving = !useIsPresent();

	useEffect(() => {
		if (!ink || !ref.current) return;
		inkStrokes.upsert({ id, el: ref.current, tone, variant, visible, hovered, disabled: !!disabled, delay, leaving, exitDelay });
	}, [ink, id, tone, variant, visible, hovered, disabled, delay, leaving, exitDelay]);
	useEffect(() => () => inkStrokes.remove(id), [id]);

	return (
		<motion.button
			ref={ref}
			type="button"
			disabled={disabled}
			onClick={onClick}
			onHoverStart={() => setHovered(true)}
			onHoverEnd={() => setHovered(false)}
			initial="hidden"
			animate={visible ? "painted" : "hidden"}
			// No hover/tap states while hidden: Motion's whileHover outranks `animate`, so a button hidden
			// under a still-hovering pointer (the gate's ENTRA, the moment it is clicked) kept its label.
			whileHover={disabled || !visible ? undefined : "bleed"}
			whileTap={disabled || !visible ? undefined : { scale: 0.97 }}
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
			{!ink && (
				<motion.span
					variants={{ hidden: { opacity: 0 }, painted: { opacity: 1, transition: { duration: 0.3 } } }}
					style={{ position: "absolute", inset: "10px 4px", borderRadius: "40% 12% 30% 10% / 50% 20% 50% 20%", background: INK_TONE_FALLBACK[tone] }}
				/>
			)}
			{/* The label settles in (letters drawing together out of a soft blur) as the ink soaks. */}
			<motion.span
				variants={{
					hidden: { opacity: 0, letterSpacing: "6px", filter: "blur(3px)" },
					painted: { opacity: 1, letterSpacing: "3px", filter: "blur(0px)", transition: { delay: delay + INK.strokePour * 0.45, duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
					bleed: { opacity: 1, letterSpacing: "4.5px", filter: "blur(0px)", transition: { duration: 0.25 } },
				}}
				// `top`: optical centring of the label on the stroke (`labelShift`).
				style={{ position: "relative", top: labelShift, color: "#f2ead9", fontSize: 16, fontWeight: 700, letterSpacing: 3, whiteSpace: "nowrap" }}
			>
				{children}
			</motion.span>
		</motion.button>
	);
};
