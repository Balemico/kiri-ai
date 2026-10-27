import { Children, isValidElement, type ReactNode } from "react";
import { motion } from "motion/react";
import { InkDelayContext } from "../../../ink/inkDelay";
import { EASE_OUT, LAYOUT_TRANSITION } from "../../../motionPresets";

export interface StaggerProps {
	children: ReactNode;
	/** Seconds between consecutive rows starting. */
	step?: number;
	/** Seconds before the first row starts (lets the previous screen finish leaving). */
	base?: number;
}

/**
 * A column whose rows enter one after another — each rising a little out of a soft blur — and
 * which leaves as one (quick fade + lift) when keyed out of an AnimatePresence. Every row's delay
 * is also handed to the ink (`InkDelayContext`), so a button's stroke is laid as its row arrives.
 */
export const Stagger = ({ children, step = 0.08, base = 0.05 }: StaggerProps) => (
	<motion.div
		layout="position"
		transition={{ layout: LAYOUT_TRANSITION }}
		exit={{ opacity: 0, y: -8, filter: "blur(3px)", transition: { duration: 0.26, ease: EASE_OUT } }}
		// Tight rows: each stroke already carries vertical air in its 70px box; back strokes add
		// their own top margin (BackStroke) to sit apart.
		style={{ display: "flex", flexDirection: "column", gap: 2 }}
	>
		{Children.toArray(children).map((child, i) => {
			const delay = base + i * step;
			return (
				<motion.div
					key={isValidElement(child) && child.key !== null ? child.key : i}
					// Rows glide too if a sibling changes size (e.g. a message appearing).
					layout="position"
					initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
					animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
					transition={{ delay, duration: 0.55, ease: EASE_OUT, layout: LAYOUT_TRANSITION }}
					style={{ display: "flex", flexDirection: "column" }}
				>
					<InkDelayContext.Provider value={delay}>{child}</InkDelayContext.Provider>
				</motion.div>
			);
		})}
	</motion.div>
);
