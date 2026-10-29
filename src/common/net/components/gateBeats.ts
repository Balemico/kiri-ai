import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { ENTRY_GATE } from "../../layout";

/** Lines in the entry gate's verse, under the logo (the text is per language: `useT().verse`). */
export const VERSE_LINES = 3;
const LINES = Array.from({ length: VERSE_LINES }, (_, i) => i);

/** The gate's opening beats, in order (each element appears when the clock reaches its beat). */
export const GATE_BEAT = {
	logo: 1, // the full logo appears, centred
	lift: 2, // the verse's room opens: the logo rises
	firstLine: 3,
	entra: 3 + VERSE_LINES,
	audio: 4 + VERSE_LINES,
} as const;

/** The ENTRA → lobby steps: ENTRA lifts away at the tap, then the lines go one by one, then the logo. */
export const GATE_OUT = {
	entra: 1,
	firstLine: 2,
	logo: 2 + VERSE_LINES,
} as const;

/**
 * The gate's opening clock — bare paper, the full logo centred, the logo rising, the verse line by
 * line, ENTRA, the audio icon. State-driven beats (a changed Motion delay never restarts a pending
 * animation — CLAUDE.md Gotchas). It starts only once the page runs smoothly: the lobby's mount
 * (shader compiles, texture uploads) stalls the main thread, and timers expiring during a stall would
 * land every beat in one frame. Same rule as the duel's ReadySignal: a run of smooth frames, capped.
 * A tap anywhere jumps to the end. Inactive (gate not shown) or reduced motion → everything at once.
 */
export const useGateBeats = (active: boolean): number => {
	const reduced = useReducedMotion();
	const [beat, setBeat] = useState(0);
	const [settled, setSettled] = useState(false);

	useEffect(() => {
		if (!active || reduced) return;
		let raf = 0;
		let smooth = 0;
		let last = performance.now();
		const t0 = last;
		const tick = (now: number) => {
			smooth = now - last < 1000 / 24 ? smooth + 1 : 0;
			last = now;
			if (smooth >= ENTRY_GATE.settleFrames || now - t0 > ENTRY_GATE.settleCap * 1000) setSettled(true);
			else raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [active, reduced]);

	useEffect(() => {
		if (!active || reduced || !settled) return;
		const { logoAt, liftAt, lineStart, lineStagger, lineDur, entraAfter, audioAfter } = ENTRY_GATE;
		const lastLineDone = lineStart + (VERSE_LINES - 1) * lineStagger + lineDur;
		const at = [logoAt, liftAt, ...LINES.map((i) => lineStart + i * lineStagger), lastLineDone + entraAfter, lastLineDone + entraAfter + audioAfter];
		const timers = at.map((s, i) => window.setTimeout(() => setBeat((b) => Math.max(b, i + 1)), s * 1000));
		return () => timers.forEach((t) => window.clearTimeout(t));
	}, [active, reduced, settled]);

	useEffect(() => {
		if (!active) return;
		const skip = () => setBeat(GATE_BEAT.audio);
		window.addEventListener("pointerdown", skip);
		return () => window.removeEventListener("pointerdown", skip);
	}, [active]);

	return !active || reduced ? GATE_BEAT.audio : beat;
};

/**
 * The ENTRA → lobby clock: `start()` (from the tap) sinks the lines back into the paper one by one,
 * dissolves the logo, then calls `onDone` (which opens the gate: the cinematic starts). Returns the
 * current step (GATE_OUT) — 0 until started. Idempotent: a second tap is ignored. Reduced motion → done
 * at once.
 */
export const useGateExit = (onDone: () => void): { out: number; start: () => void } => {
	const reduced = useReducedMotion();
	const [out, setOut] = useState(0);
	const timers = useRef<number[]>([]);
	const started = useRef(false);

	useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

	const start = () => {
		if (started.current) return;
		started.current = true;
		if (reduced) {
			setOut(GATE_OUT.logo);
			onDone();
			return;
		}
		const { outLineStart, outLineStagger, outLineDur, logoOutAfter, logoOutDur } = ENTRY_GATE;
		const logoAt = outLineStart + (VERSE_LINES - 1) * outLineStagger + outLineDur + logoOutAfter;
		const steps = [...LINES.map((i) => outLineStart + i * outLineStagger), logoAt];
		timers.current = steps.map((s, i) => window.setTimeout(() => setOut((o) => Math.max(o, GATE_OUT.firstLine + i)), s * 1000));
		timers.current.push(window.setTimeout(onDone, (logoAt + logoOutDur) * 1000));
		setOut(GATE_OUT.entra);
	};

	return { out, start };
};
