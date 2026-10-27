import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { motion } from "motion/react";
import { PlaneGeometry, type Mesh } from "three";
import { InkCanvas } from "../../atoms/InkCanvas";
import { createVeilMaterial, inkUniforms, type VeilUniforms } from "../../../ink/inkNodes";
import { phaseProgress, veilStrokes } from "../../../ink/inkMath";
import { inkSupported } from "../../../ink/inkRegistry";
import { useInkControls } from "../../../hooks/useInkControls";
import { INK } from "../../../layout";

const PLANE = new PlaneGeometry(1, 1);
// A beat with the screen fully inked before the swap, so the cover reads as settled.
const HOLD = 0.12;

interface VeilProps {
	release: boolean;
	onCovered: () => void;
	onDone: () => void;
}

/**
 * The full-screen veil. Giant brush slashes cut across in sequence, a flood seals the gaps →
 * `onCovered` (the canvases swap underneath). On `release` the flood drains and the slashes dry
 * into bristle streaks that thin out and vanish → `onDone` (the canvas unmounts).
 */
const Veil = ({ release, onCovered, onDone }: VeilProps) => {
	useInkControls();
	const size = useThree((s) => s.size);
	const aspect = size.width / Math.max(1, size.height);
	// Stroke geometry is baked into the shader: rebuilt only if the aspect changes mid-veil.
	const material = useMemo(() => createVeilMaterial(veilStrokes(INK.veilStrokes, aspect, 7)).material, [aspect]);
	useEffect(() => () => material.dispose(), [material]);
	const mesh = useRef<Mesh>(null);

	// Latest props for the frame loop (effects — render-time ref writes are lint-forbidden).
	const cb = useRef({ release, onCovered, onDone });
	useEffect(() => {
		cb.current = { release, onCovered, onDone };
	}, [release, onCovered, onDone]);
	const clock = useRef({ start: -1, covered: false, releasedAt: -1, done: false });

	useFrame(({ clock: c }) => {
		const m = mesh.current;
		if (!m) return;
		const u = inkUniforms<VeilUniforms>(m.material);
		const k = clock.current;
		const now = c.elapsedTime;
		if (k.start < 0) k.start = now;
		u.resolution.value.set(size.width, size.height);
		u.pour.value = phaseProgress(now - k.start, INK.veilPour);
		if (!k.covered && now - k.start >= INK.veilPour + HOLD) {
			k.covered = true;
			cb.current.onCovered();
		}
		if (cb.current.release && k.covered) {
			if (k.releasedAt < 0) k.releasedAt = now;
			const p = phaseProgress(now - k.releasedAt, INK.veilDry);
			u.dry.value = p * p * (3 - 2 * p); // flood drains, then the slashes dry into streaks
			if (p >= 1 && !k.done) {
				k.done = true;
				cb.current.onDone();
			}
		}
	});

	return <mesh ref={mesh} geometry={PLANE} material={material} scale={[size.width, size.height, 1]} />;
};

/** No WebGPU and no WebGL2: a plain ink fade keeps the swap covered. */
const FallbackVeil = ({ release, onCovered, onDone }: VeilProps) => (
	<motion.div
		initial={{ opacity: 0 }}
		animate={{ opacity: release ? 0 : 1 }}
		transition={{ duration: release ? INK.veilDry * 0.6 : INK.veilPour * 0.6 }}
		onAnimationComplete={() => (release ? onDone() : onCovered())}
		style={{ position: "absolute", inset: 0, background: INK.inkColor }}
	/>
);

export interface InkTransitionProps {
	/** True while the app wants the screen covered (game starting). */
	covering: boolean;
	/** True once the far side is ready — lets the ink dry out and reveal it. */
	release: boolean;
	onCovered: () => void;
}

/**
 * The lobby→duel veil, as slashed sumi (TSL shader, `ink/inkNodes`). It blocks input while it
 * covers; once released and dried out it UNMOUNTS (no full-screen canvas idling over the duel).
 * `done` resets whenever `covering` drops, re-arming the veil for the next session.
 */
export const InkTransition = ({ covering, release, onCovered }: InkTransitionProps) => {
	const [done, setDone] = useState(false);
	// Re-arm for the next session — adjusted during render ("state from props"), not in an effect.
	if (!covering && done) setDone(false);
	if (!covering || done) return null;

	const props: VeilProps = { release, onCovered, onDone: () => setDone(true) };
	return (
		<div style={{ position: "fixed", inset: 0, zIndex: 4000, pointerEvents: release ? "none" : "auto" }}>
			{inkSupported() ? (
				// Capped DPR: a full-screen fbm shader at 3× would cost a phone dearly for no visible gain.
				<InkCanvas maxDpr={1.5}>
					<Veil {...props} />
				</InkCanvas>
			) : (
				<FallbackVeil {...props} />
			)}
		</div>
	);
};
