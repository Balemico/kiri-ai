import { AnimatePresence, motion } from "motion/react";
import { INTRO } from "../../../layout";

const VEILS = ["/images/intro/veil-1.png", "/images/intro/veil-2.png", "/images/intro/veil-3.png"];

// Four sweeps cover the screen with overlap; a fifth solid layer seals any mask gaps.
const STROKES = [
	{ top: "-6%", height: "34vh", rotate: -7, dir: 1, veil: VEILS[0] },
	{ top: "20%", height: "36vh", rotate: 5, dir: -1, veil: VEILS[1] },
	{ top: "46%", height: "36vh", rotate: -4, dir: 1, veil: VEILS[2] },
	{ top: "72%", height: "38vh", rotate: 8, dir: -1, veil: VEILS[0] },
];

export interface InkTransitionProps {
	/** True while the app wants the screen covered (game starting). */
	covering: boolean;
	/** True once the far side is ready — lets the ink dry out and reveal it. */
	release: boolean;
	onCovered: () => void;
}

/**
 * The lobby→duel veil: sumi strokes sweep the screen one after another until it is fully inked
 * (→ `onCovered`, the canvases swap underneath), hold, then — once `release` — each stroke "dries"
 * (edges lighten and granulate, then fades) unveiling the new scene already in motion.
 */
export const InkTransition = ({ covering, release, onCovered }: InkTransitionProps) => (
	<AnimatePresence>
		{covering && (
			<motion.div key="veil" style={{ position: "fixed", inset: 0, zIndex: 4000, pointerEvents: "none", overflow: "hidden" }} exit={{ opacity: 0 }}>
				{STROKES.map((s, i) => (
					<motion.div
						key={i}
						initial={{ x: `${s.dir * -130}vw` }}
						animate={
							release
								? { x: "0vw", opacity: 0, filter: "brightness(1.6) contrast(1.5) blur(1.5px)" }
								: { x: "0vw", opacity: 1, filter: "brightness(1) contrast(1) blur(0px)" }
						}
						transition={
							release
								? { duration: INTRO.veilDry, delay: i * INTRO.veilStrokeStagger, ease: "easeIn" }
								: { duration: INTRO.veilCover, delay: i * INTRO.veilStrokeStagger, ease: [0.3, 0, 0.2, 1] }
						}
						style={{
							position: "absolute",
							left: "-15vw",
							top: s.top,
							width: "130vw",
							height: s.height,
							rotate: s.rotate,
							background: "#17120e",
							WebkitMaskImage: `url(${s.veil})`,
							maskImage: `url(${s.veil})`,
							WebkitMaskSize: "100% 100%",
							maskSize: "100% 100%",
						}}
					/>
				))}
				{/* Seal: closes the ragged gaps between strokes right as the last sweep lands. */}
				<motion.div
					initial={{ opacity: 0 }}
					animate={release ? { opacity: 0 } : { opacity: 1 }}
					transition={
						release
							? { duration: INTRO.veilDry * 0.6 }
							: { duration: 0.18, delay: STROKES.length * INTRO.veilStrokeStagger + INTRO.veilCover * 0.7 }
					}
					onAnimationComplete={() => {
						if (!release) onCovered();
					}}
					style={{ position: "absolute", inset: 0, background: "#17120e" }}
				/>
			</motion.div>
		)}
	</AnimatePresence>
);
