import { useEffect } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react";
import { INTRO } from "../../../layout";
import { inkFrameBlend, inkFrameSrc, preloadInkFrames } from "../../../inkFrames";

// Four sweeps cover the screen with overlap; a fifth solid layer seals any mask gaps.
// `flip` mirrors the whole stroke: frames are baked left→right, so -1 draws right→left.
const STROKES = [
	{ top: "-6%", height: "34vh", rotate: -7, flip: 1, veil: "veil-1" },
	{ top: "20%", height: "36vh", rotate: 5, flip: -1, veil: "veil-2" },
	{ top: "46%", height: "36vh", rotate: -4, flip: 1, veil: "veil-3" },
	{ top: "72%", height: "38vh", rotate: 8, flip: -1, veil: "veil-1" },
] as const;

for (const name of ["veil-1", "veil-2", "veil-3"]) {
	preloadInkFrames(name, INTRO.paintFrames);
	if (typeof window !== "undefined") new Image().src = `/images/intro/${name}-dry.png`;
}

const MASK_LAYER: CSSProperties = {
	position: "absolute",
	inset: 0,
	background: "#17120e",
	WebkitMaskSize: "100% 100%",
	maskSize: "100% 100%",
};

interface VeilStrokeProps {
	def: (typeof STROKES)[number];
	index: number;
	release: boolean;
}

/**
 * One sweep: a Motion value scrubs the 12 paint frames (two stacked mask layers crossfading,
 * as in InkStrokeButton) while a residual x-drag keeps the wrist moving — drawn by a gesture,
 * not stamped. On release the wet ink thins to its granulated `-dry` skeleton (pre-baked
 * variant, no runtime SVG filters), then the whole stroke brightens and fades.
 */
const VeilStroke = ({ def, index, release }: VeilStrokeProps) => {
	const progress = useMotionValue(0);
	useEffect(() => {
		const ctrl = animate(progress, 1, {
			duration: INTRO.veilCover,
			delay: index * INTRO.veilStrokeStagger,
			ease: [0.3, 0, 0.2, 1],
		});
		return () => ctrl.stop();
	}, [progress, index]);

	const maskA = useTransform(progress, (v) => `url(${inkFrameSrc(def.veil, inkFrameBlend(v, INTRO.paintFrames).a)})`);
	const maskB = useTransform(progress, (v) => `url(${inkFrameSrc(def.veil, inkFrameBlend(v, INTRO.paintFrames).b)})`);
	const blend = useTransform(progress, (v) => inkFrameBlend(v, INTRO.paintFrames).blend);
	// Frame f01 is not empty — keep the stroke invisible until its delayed tween actually starts.
	const started = useTransform(progress, (v) => (v > 0 ? 1 : 0));
	// Scaled by def.flip: mirrored strokes (scaleX: -1) draw right→left, so the drag must too.
	const x = useTransform(progress, (v) => `${(1 - v) * -INTRO.veilDrag * def.flip}vw`);
	const dry = `url(/images/intro/${def.veil}-dry.png)`;

	return (
		<motion.div
			animate={release ? { opacity: 0, filter: "brightness(1.6) contrast(1.5)" } : { opacity: 1, filter: "brightness(1) contrast(1)" }}
			transition={release ? { duration: INTRO.veilDry, delay: index * INTRO.veilStrokeStagger, ease: "easeIn" } : { duration: 0 }}
			style={{
				position: "absolute",
				left: "-15vw",
				top: def.top,
				width: "130vw",
				height: def.height,
				rotate: def.rotate,
				scaleX: def.flip,
				x,
			}}
		>
			<motion.span style={{ position: "absolute", inset: 0, opacity: started }}>
				{/* Wet stroke: fades to its dry skeleton on release (the drying is the delta). */}
				<motion.span
					animate={release ? { opacity: 0 } : { opacity: 1 }}
					transition={release ? { duration: INTRO.veilDry * 0.4, delay: index * INTRO.veilStrokeStagger } : { duration: 0 }}
					style={{ position: "absolute", inset: 0 }}
				>
					<motion.span style={{ ...MASK_LAYER, WebkitMaskImage: maskA, maskImage: maskA }} />
					<motion.span style={{ ...MASK_LAYER, opacity: blend, WebkitMaskImage: maskB, maskImage: maskB }} />
				</motion.span>
				<motion.span
					animate={release ? { opacity: 1 } : { opacity: 0 }}
					transition={release ? { duration: INTRO.veilDry * 0.4, delay: index * INTRO.veilStrokeStagger } : { duration: 0 }}
					style={{ ...MASK_LAYER, WebkitMaskImage: dry, maskImage: dry }}
				/>
			</motion.span>
		</motion.div>
	);
};

export interface InkTransitionProps {
	/** True while the app wants the screen covered (game starting). */
	covering: boolean;
	/** True once the far side is ready — lets the ink dry out and reveal it. */
	release: boolean;
	onCovered: () => void;
}

/**
 * The lobby→duel veil: sumi strokes are DRAWN onto the screen one after another until it is
 * fully inked (→ `onCovered`, the canvases swap underneath), hold, then — once `release` —
 * each stroke dries to a granulated skeleton and fades, unveiling the new scene in motion.
 */
export const InkTransition = ({ covering, release, onCovered }: InkTransitionProps) => (
	<AnimatePresence>
		{covering && (
			<motion.div
				key="veil"
				// While covering the old screen must not accept clicks; once drying (release), the new scene is live.
				style={{ position: "fixed", inset: 0, zIndex: 4000, pointerEvents: release ? "none" : "auto", overflow: "hidden" }}
				exit={{ opacity: 0 }}
			>
				{STROKES.map((s, i) => (
					<VeilStroke key={i} def={s} index={i} release={release} />
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
