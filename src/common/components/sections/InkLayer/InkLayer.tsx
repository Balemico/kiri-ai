import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PlaneGeometry, type Mesh } from "three";
import { InkCanvas } from "../../atoms/InkCanvas";
import { createStrokeMaterial, inkUniforms, type StrokeUniforms } from "../../../ink/inkNodes";
import { easeInOutCubic, phaseProgress } from "../../../ink/inkMath";
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
		const age = startedAt.current === null ? 0 : clock.elapsedTime - startedAt.current;
		// Soft in, soft out: the stroke opens from the middle as the ink soaks in.
		u.pour.value = easeInOutCubic(phaseProgress(age, INK.strokePour));
		// Hover reaches the ends out and thickens a touch — eased exponentially (frame-rate
		// independent), so it glides in and out instead of popping.
		hover.current += ((e.hovered && !e.disabled ? 1 : 0) - hover.current) * (1 - Math.exp(-dt * 7));
		u.hover.value = hover.current;

		const tone = TONE[e.tone];
		u.tint.value.set(tone.tint);
		u.tintAmount.value = tone.amount;
		u.opacity.value = tone.opacity * effectiveOpacity(e.el);
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
 * The lobby's ink: a transparent TSL canvas between the panorama and the menu column, drawing a
 * living sumi stroke under every registered `InkStrokeButton`. The labels stay DOM, on top.
 */
export const InkLayer = () => {
	const entries = useSyncExternalStore(inkStrokes.subscribe, inkStrokes.getSnapshot);
	if (!inkSupported()) return null;
	return (
		<InkCanvas>
			<Strokes entries={entries} />
		</InkCanvas>
	);
};
