import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PlaneGeometry, type Mesh } from "three";
import { InkCanvas } from "../../atoms/InkCanvas";
import { createStrokeMaterial, inkUniforms, type StrokeUniforms } from "../../../ink/inkNodes";
import { easeOutCubic, phaseProgress } from "../../../ink/inkMath";
import { effectiveOpacity, inkStrokes, inkSupported, type InkStrokeEntry, type InkTone } from "../../../ink/inkRegistry";
import { useInkControls } from "../../../hooks/useInkControls";
import { INK } from "../../../layout";

// One unit plane, scaled per stroke to its button box (+ margin for the tail, wash and spray).
const PLANE = new PlaneGeometry(1, 1);

const TONE: Record<InkTone, { tint: string; amount: number; opacity: number }> = {
	ink: { tint: INK.inkColor, amount: 0, opacity: 1 },
	red: { tint: "#b73225", amount: 1, opacity: 1 },
	blue: { tint: "#2f6f86", amount: 1, opacity: 1 },
	ghost: { tint: INK.inkColor, amount: 0, opacity: 0.34 },
};

/**
 * One button's stroke. Each frame it re-reads the button's rect (so Motion slides, layout
 * changes and resizes are tracked for free) and its effective DOM opacity (so screen cross-fades
 * fade the ink with the label). The pour starts the first frame the button is `visible`.
 */
const StrokeMesh = ({ entry }: { entry: InkStrokeEntry }) => {
	const mesh = useRef<Mesh>(null);
	const size = useThree((s) => s.size);
	const material = useMemo(() => createStrokeMaterial().material, []);
	useEffect(() => () => material.dispose(), [material]);
	// Latest entry for the frame loop (written in an effect — render-time ref writes are lint-forbidden).
	const latest = useRef(entry);
	useEffect(() => {
		latest.current = entry;
	}, [entry]);
	const startedAt = useRef<number | null>(null);
	const hover = useRef(0);
	const segActive = useRef(entry.segment?.active ?? 0);

	useFrame(({ clock }, dt) => {
		const e = latest.current;
		const m = mesh.current;
		if (!m) return;
		const u = inkUniforms<StrokeUniforms>(m.material);
		const r = e.el.getBoundingClientRect();
		const margin = INK.strokeMargin;
		const w = r.width + margin * 2;
		const h = r.height + margin * 2;
		m.position.set(r.left + r.width / 2 - size.width / 2, size.height / 2 - (r.top + r.height / 2), 0);
		m.scale.set(w, h, 1);
		u.size.value.set(w, h);

		if (!e.visible) startedAt.current = null;
		else if (startedAt.current === null) startedAt.current = clock.elapsedTime;
		// A staggered row lays its stroke when the row arrives (`delay`), not when it mounts.
		const age = startedAt.current === null ? 0 : Math.max(0, clock.elapsedTime - startedAt.current - e.delay);
		// The brush sets off at once and slows as it lands (ease-out): a slow start would leave the
		// row empty for a beat, stalling the screen's stagger. The ink soaks in behind it.
		u.pour.value = easeOutCubic(phaseProgress(age, INK.strokePour));
		// Hover reaches the ends out and thickens a touch — eased exponentially (frame-rate
		// independent), so it glides in and out instead of popping.
		hover.current += ((e.hovered && !e.disabled ? 1 : 0) - hover.current) * (1 - Math.exp(-dt * 7));
		u.hover.value = hover.current;

		const tone = TONE[e.tone];
		u.tint.value.set(tone.tint);
		u.tintAmount.value = tone.amount;
		u.opacity.value = tone.opacity * effectiveOpacity(e.el);
		// Split toggle: the lit half glides across (eased) when the choice changes.
		const seg = e.segment;
		u.segOn.value = seg ? 1 : 0;
		if (seg) {
			u.segLeft.value.set(TONE[seg.left].tint);
			u.segRight.value.set(TONE[seg.right].tint);
			segActive.current += (seg.active - segActive.current) * (1 - Math.exp(-dt * 6));
			u.segActive.value = segActive.current;
		}
		u.seed.value = e.variant * 1.7 + e.id * 0.31;
	});

	return <mesh ref={mesh} geometry={PLANE} material={material} />;
};

const Strokes = ({ entries }: { entries: InkStrokeEntry[] }) => {
	useInkControls();
	return (
		<>
			{entries.map((e) => (
				<StrokeMesh key={e.id} entry={e} />
			))}
		</>
	);
};

/**
 * Button ink: a transparent TSL canvas drawing a living sumi stroke under every registered
 * `InkStrokeButton`; the labels stay DOM, on top. The lobby places it by DOM order (between the
 * panorama and the menu column); the duel gives it a z-index just under its button overlay.
 */
export const InkLayer = ({ zIndex }: { zIndex?: number }) => {
	const entries = useSyncExternalStore(inkStrokes.subscribe, inkStrokes.getSnapshot);
	if (!inkSupported()) return null;
	return (
		<InkCanvas style={zIndex === undefined ? undefined : { zIndex }}>
			<Strokes entries={entries} />
		</InkCanvas>
	);
};
