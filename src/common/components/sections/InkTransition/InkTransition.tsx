import { useEffect } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react";
import { INTRO } from "../../../layout";
import { WIPE_LEFT, WIPE_WIDTH, inkWipeSrc, preloadInk, wipeTravel } from "../../../inkWipe";

// Four sweeps cover the screen with overlap; a fifth solid layer seals any mask gaps.
// `flip` mirrors the whole stroke: wipes travel left→right, so -1 draws right→left.
const STROKES = [
	{ top: "-6%", height: "34vh", rotate: -7, flip: 1, veil: "veil-1", wipe: 0 },
	{ top: "20%", height: "36vh", rotate: 5, flip: -1, veil: "veil-2", wipe: 1 },
	{ top: "46%", height: "36vh", rotate: -4, flip: 1, veil: "veil-3", wipe: 2 },
	{ top: "72%", height: "38vh", rotate: 8, flip: -1, veil: "veil-1", wipe: 1 },
] as const;

preloadInk([
	...["veil-1", "veil-2", "veil-3"].flatMap((n) => [`/images/intro/${n}.png`, `/images/intro/${n}-dry.png`]),
	...[0, 1, 2].map(inkWipeSrc),
]);

const MASK_FILL: CSSProperties = {
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
 * One sweep: the veil mask stays static while an ink fill masked by a ragged wipe ramp slides
 * across underneath (continuous frontier — no frame steps), and a residual x-drag keeps the
 * wrist moving: drawn by a gesture, not stamped. On release the wet ink thins to its
 * granulated `-dry` skeleton (pre-baked variant, no runtime SVG filters), then the whole
 * stroke brightens and fades.
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

	const xWipe = useTransform(progress, wipeTravel);
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
			{/* Wet stroke: fades to its dry skeleton on release (the drying is the delta). */}
			<motion.span
				animate={release ? { opacity: 0 } : { opacity: 1 }}
				transition={release ? { duration: INTRO.veilDry * 0.4, delay: index * INTRO.veilStrokeStagger } : { duration: 0 }}
				style={{
					position: "absolute",
					inset: 0,
					overflow: "hidden",
					WebkitMaskImage: `url(/images/intro/${def.veil}.png)`,
					maskImage: `url(/images/intro/${def.veil}.png)`,
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
						background: "#17120e",
						WebkitMaskImage: `url(${inkWipeSrc(def.wipe)})`,
						maskImage: `url(${inkWipeSrc(def.wipe)})`,
						WebkitMaskSize: "100% 100%",
						maskSize: "100% 100%",
						x: xWipe,
					}}
				/>
			</motion.span>
			<motion.span
				animate={release ? { opacity: 1 } : { opacity: 0 }}
				transition={release ? { duration: INTRO.veilDry * 0.4, delay: index * INTRO.veilStrokeStagger } : { duration: 0 }}
				style={{ ...MASK_FILL, WebkitMaskImage: dry, maskImage: dry }}
			/>
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
