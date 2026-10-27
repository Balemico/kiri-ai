import { useContext, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { motion, useIsPresent } from "motion/react";
import { inkStrokes, INK_TONE_FALLBACK, inkSupported, newInkStrokeId, type InkTone } from "../../../ink/inkRegistry";
import { INK } from "../../../layout";
import { InkDelayContext } from "../../../ink/inkDelay";

export interface InkStrokeButtonProps {
	children: ReactNode;
	onClick?: () => void;
	disabled?: boolean;
	tone?: InkTone;
	/** Which brush (also seeds the stroke's shape) — siblings never look cloned. */
	variant?: 0 | 1 | 2;
	/** Vermilion hanko dot at the stroke's end — the primary action's mark. */
	seal?: boolean;
	/** False = still hidden (intro choreography); flipping to true lays the stroke NOW. */
	visible?: boolean;
	style?: CSSProperties;
}

/**
 * A menu button whose body is a living sumi stroke. The ink itself is drawn by the lobby's
 * `InkLayer` (TSL shader on its own canvas, under the menu column): this button only REGISTERS
 * its element + state, and keeps the label and seal in the DOM on top. `visible` stays the
 * state-driven trigger of the choreography (an intro skip flips every beat at once and each
 * stroke starts pouring that frame).
 */
export const InkStrokeButton = ({ children, onClick, disabled, tone = "ink", variant = 0, seal = false, visible = true, style }: InkStrokeButtonProps) => {
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
				style={{ position: "relative", color: "#f2ead9", fontSize: 16, fontWeight: 700, letterSpacing: 3, whiteSpace: "nowrap" }}
			>
				{children}
			</motion.span>
			{seal && (
				<motion.span
					variants={{
						hidden: { opacity: 0, scale: 0.4, rotate: -6 },
						painted: { opacity: 1, scale: 1, rotate: -6, transition: { delay: delay + INK.strokePour, duration: 0.3 } },
					}}
					style={{
						position: "absolute",
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
