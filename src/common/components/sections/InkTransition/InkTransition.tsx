import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { motion } from "motion/react";
import { PlaneGeometry, type Mesh } from "three";
import type { WebGPURenderer } from "three/webgpu";
import { InkCanvas } from "../../atoms/InkCanvas";
import { createVeilMaterial, inkUniforms, type VeilUniforms } from "../../../ink/inkNodes";
import { phaseProgress, veilStrokes } from "../../../ink/inkMath";
import { inkSupported } from "../../../ink/inkRegistry";
import { useInkControls } from "../../../hooks/useInkControls";
import { INK } from "../../../layout";
import { VEIL_OPEN_AT, veilSignal } from "../../../ink/veilSignal";

const PLANE = new PlaneGeometry(1, 1);
// A beat with the screen fully inked before the swap, so the cover reads as settled.
const HOLD = 0.12;
// Longest step the veil's clock advances in one frame (s): a stalled frame can't skip the ink ahead.
const MAX_STEP = 1 / 30;

interface VeilProps {
	covering: boolean;
	release: boolean;
	onCovered: () => void;
	onDone: () => void;
}

/**
 * The full-screen veil, PERSISTENT: mounted (idle, transparent) from the first lobby frame, so
 * its heavy pipeline is compiled ahead of time (`compileAsync`) instead of freezing the first
 * frame after the click. Each session runs on the same material:
 *   covering → slashes cut across one over another, a flood seals the gaps → `onCovered`
 *   release  → the flood drains, the slashes dry at different times → `onDone`
 * Session state lives in a ref, re-armed (in an effect) whenever a session ends.
 */
const Veil = ({ covering, release, onCovered, onDone }: VeilProps) => {
	useInkControls();
	const size = useThree((s) => s.size);
	const gl = useThree((s) => s.gl);
	const scene = useThree((s) => s.scene);
	const camera = useThree((s) => s.camera);
	const invalidate = useThree((s) => s.invalidate);
	const aspect = size.width / Math.max(1, size.height);
	// Stroke geometry is baked into the shader: rebuilt only if the aspect changes.
	const material = useMemo(() => createVeilMaterial(veilStrokes(INK.veilStrokes, aspect, 7)).material, [aspect]);
	useEffect(() => () => material.dispose(), [material]);
	// Compile the pipeline off the critical path while the canvas idles in the lobby.
	useEffect(() => {
		const r = gl as unknown as WebGPURenderer;
		let alive = true;
		void r.compileAsync?.(scene, camera).then(() => {
			if (alive) invalidate();
		});
		return () => {
			alive = false;
		};
	}, [gl, scene, camera, material, invalidate]);

	const mesh = useRef<Mesh>(null);
	// Latest props for the frame loop (effects — render-time ref writes are lint-forbidden).
	const cb = useRef({ covering, release, onCovered, onDone });
	useEffect(() => {
		cb.current = { covering, release, onCovered, onDone };
	}, [covering, release, onCovered, onDone]);
	// Session clock: ACCUMULATED frame time, each frame capped — after a hitch (the duel mounting
	// underneath) the ink resumes where it was instead of jumping ahead, so the drying is always seen.
	const idle = { active: false, t: 0, covered: false, releasedAt: -1, done: false };
	const run = useRef(idle);
	// Re-arm when a session ends. In an effect, not the frame loop: an idle canvas renders no frames.
	useEffect(() => {
		if (!covering) run.current = { active: false, t: 0, covered: false, releasedAt: -1, done: false };
	}, [covering]);

	useFrame((_, dt) => {
		const m = mesh.current;
		if (!m) return;
		const u = inkUniforms<VeilUniforms>(m.material);
		const k = run.current;
		u.resolution.value.set(size.width, size.height);
		if (!cb.current.covering) {
			// Idle between sessions (the one frame a parked canvas renders): nothing on screen.
			u.pour.value = 0;
			u.dry.value = 0;
			return;
		}
		if (!k.active) {
			Object.assign(k, { active: true, t: 0 });
			u.dry.value = 0;
			veilSignal.set(false);
		} else k.t += Math.min(dt, MAX_STEP);
		const now = k.t;
		u.pour.value = phaseProgress(now, INK.veilPour);
		if (!k.covered && now >= INK.veilPour + HOLD) {
			k.covered = true;
			cb.current.onCovered();
		}
		if (cb.current.release && k.covered && !k.done) {
			if (k.releasedAt < 0) k.releasedAt = now;
			u.dry.value = phaseProgress(now - k.releasedAt, INK.veilDry);
			if (u.dry.value >= VEIL_OPEN_AT) veilSignal.set(true);
			if (u.dry.value >= 1) {
				k.done = true;
				cb.current.onDone();
			}
		}
	});

	return <mesh ref={mesh} geometry={PLANE} material={material} scale={[size.width, size.height, 1]} />;
};

/** No WebGPU and no WebGL2: a plain ink fade keeps the swap covered. */
const FallbackVeil = ({ covering, release, onCovered, onDone }: VeilProps) =>
	covering ? (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: release ? 0 : 1 }}
			transition={{ duration: release ? INK.veilDry * 0.6 : INK.veilPour * 0.6 }}
			onAnimationComplete={() => {
				if (release) {
					veilSignal.set(true);
					onDone();
				} else onCovered();
			}}
			style={{ position: "absolute", inset: 0, background: INK.inkColor }}
		/>
	) : null;

export interface InkTransitionProps {
	/** True while the app wants the screen covered (game starting). */
	covering: boolean;
	/** True once the far side is ready — lets the ink dry out and reveal it. */
	release: boolean;
	onCovered: () => void;
}

/**
 * The lobby→duel veil, as slashed sumi (TSL shader, `ink/inkNodes`). Always mounted; its canvas
 * only renders frames while a session runs (`frameloop` "always"), parked on "demand" otherwise,
 * so it costs nothing over the duel. It blocks input while covering. `done` resets whenever
 * `covering` drops, re-arming the veil for the next session.
 */
export const InkTransition = ({ covering, release, onCovered }: InkTransitionProps) => {
	const [done, setDone] = useState(false);
	// Re-arm for the next session — adjusted during render ("state from props"), not in an effect.
	if (!covering && done) setDone(false);
	const running = covering && !done;

	// Safety nets on the wall clock — the sequence must never hang on GPU frames arriving (a
	// stalled or lost canvas would otherwise freeze the app under a black veil):
	//  - cover: if the veil hasn't reported covered shortly after its pour should have ended;
	//  - finish: if it hasn't dried out shortly after its drying should have ended.
	const coveredOnce = useRef(false);
	const onCoveredOnce = () => {
		if (coveredOnce.current) return;
		coveredOnce.current = true;
		onCovered();
	};
	useEffect(() => {
		if (!running) {
			coveredOnce.current = false;
			return;
		}
		const t = window.setTimeout(onCoveredOnce, (INK.veilPour + 2) * 1000);
		return () => window.clearTimeout(t);
		// eslint-disable-next-line react-hooks/exhaustive-deps -- armed once per session
	}, [running]);
	useEffect(() => {
		if (!running || !release) return;
		const t = window.setTimeout(() => setDone(true), (INK.veilDry + 3) * 1000);
		return () => window.clearTimeout(t);
	}, [running, release]);
	// Whenever a session ends (normally, by the safety net, or with no canvas at all) the duel
	// is visible: the open signal must never be left false.
	useEffect(() => {
		if (!running && covering) veilSignal.set(true);
	}, [running, covering]);

	const props: VeilProps = { covering: running, release, onCovered: onCoveredOnce, onDone: () => setDone(true) };
	return (
		<div
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 4000,
				pointerEvents: running && !release ? "auto" : "none",
				// Belt and braces: once a session is over the layer fades out even if its canvas froze
				// on an inked frame.
				opacity: running ? 1 : 0,
				transition: running ? "none" : "opacity 0.4s ease",
			}}
		>
			{inkSupported() ? (
				// DPR 0.75: a full-screen multi-stroke shader; the soft, moving ink loses nothing below
				// 1× and the fill cost drops by almost half.
				<InkCanvas dpr={0.75} frameloop={running ? "always" : "demand"}>
					<Veil {...props} />
				</InkCanvas>
			) : (
				<FallbackVeil {...props} />
			)}
		</div>
	);
};
