import { Children, isValidElement, type ReactNode } from "react";
import { motion } from "motion/react";
import { InkDelayContext } from "../../../ink/inkDelay";
import { EASE_IN, EASE_OUT, EXIT_DURATION, EXIT_STEP, LAYOUT_TRANSITION } from "../../../motionPresets";

export interface StaggerProps {
	children: ReactNode;
	/** Seconds between consecutive rows starting. */
	step?: number;
	/** Seconds before the first row starts (lets the previous screen finish leaving). */
	base?: number;
	/** Pixels between rows (tight by default — strokes carry their own air). */
	gap?: number;
}

/**
 * A column whose rows enter one after another — each rising a little out of a soft blur — and,
 * when keyed out of an AnimatePresence, leave the same way in reverse (bottom row first). Each
 * row's timing is handed to the ink (`InkDelayContext`): a button's stroke is laid as its row
 * arrives and lifts away as its row leaves.
 */
export const Stagger = ({ children, step = 0.08, base = 0.05, gap = 2 }: StaggerProps) => (
	<motion.div
		layout="position"
		transition={{ layout: LAYOUT_TRANSITION }}
		// Tight rows: each stroke already carries vertical air in its 70px box; back strokes add
		// their own top margin (BackStroke) to sit apart.
		style={{ display: "flex", flexDirection: "column", gap }}
	>
		{Children.toArray(children).map((child, i, all) => {
			const delay = base + i * step;
			// Leaving runs in reverse: the bottom row goes first, the heading last.
			const exitDelay = (all.length - 1 - i) * EXIT_STEP;
			return (
				<motion.div
					key={isValidElement(child) && child.key !== null ? child.key : i}
					// Rows glide too if a sibling changes size (e.g. a message appearing).
					layout="position"
					initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
					animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
					exit={{ opacity: 0, y: -8, filter: "blur(4px)", transition: { delay: exitDelay, duration: EXIT_DURATION, ease: EASE_IN } }}
					transition={{ delay, duration: 0.55, ease: EASE_OUT, layout: LAYOUT_TRANSITION }}
					style={{ display: "flex", flexDirection: "column" }}
				>
					<InkDelayContext.Provider value={{ enter: delay, exit: exitDelay }}>{child}</InkDelayContext.Provider>
				</motion.div>
			);
		})}
	</motion.div>
);
