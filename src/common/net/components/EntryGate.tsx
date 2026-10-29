import type { ReactNode } from "react";
import { motion } from "motion/react";
import { InkStrokeButton, Stagger } from "../../components/atoms";
import { unlockAudio } from "../../audio";
import { ENTRY_GATE, PAPER } from "../../layout";
import { EASE_IN } from "../../motionPresets";
import { setMusicScene, unlockMusic } from "../../music";
import { useT, type MessageId } from "../../i18n";
import { GATE_BEAT, GATE_OUT } from "./gateBeats";
import { usePortraitWindow } from "./ui";

const INK_COLOR = "#17120e";
/** One message per verse line — VERSE_LINES of them (the gate's clock has a beat per line). */
const VERSE_IDS: MessageId[] = ["gate.verse.0", "gate.verse.1", "gate.verse.2"];

/**
 * One verse line rising out of the paper: it starts as a pale, diffuse stain in the paper's own tone
 * and condenses into sharp ink — as if soaking through from the back of the sheet, not written on it.
 * On ENTRA it sinks back the same way, quicker.
 */
const InkLine = ({ shown, nowrap, children }: { shown: boolean; nowrap: boolean; children: ReactNode }) => (
	<motion.p
		variants={{
			hidden: {
				opacity: 0,
				filter: "blur(7px)",
				color: PAPER,
				textShadow: "0 0 10px rgba(23, 18, 14, 0)",
				scale: 1.015,
				transition: { duration: ENTRY_GATE.outLineDur, ease: EASE_IN },
			},
			risen: {
				opacity: 1,
				filter: "blur(0px)",
				color: INK_COLOR,
				// A hair of bleed stays, as if the ink spread into the fibres.
				textShadow: "0 0 0.6px rgba(23, 18, 14, 0.55)",
				scale: 1,
				transition: { duration: ENTRY_GATE.lineDur, ease: [0.33, 0, 0.2, 1] },
			},
		}}
		initial="hidden"
		animate={shown ? "risen" : "hidden"}
		style={{
			margin: 0,
			textAlign: "center",
			// One verse per line where it fits (landscape: wider than the menu column, centred over it);
			// portrait is too narrow for the longest line, so it may wrap there.
			whiteSpace: nowrap ? "nowrap" : "normal",
			fontSize: 15,
			letterSpacing: 1.5,
			lineHeight: 1.55,
		}}
	>
		{children}
	</motion.p>
);

/**
 * The gate's verse + ENTRA, under Lobby's logo (Lobby owns both clocks: `useGateBeats` → `beat`,
 * `useGateExit` → `out`). Mounted only from the lift beat — its arrival is what makes the logo rise.
 * Browsers only allow sound after a real gesture — ENTRA is that gesture. Everything audible starts
 * SYNCHRONOUSLY inside its handler (older iOS Safari has no sticky activation): the lobby track and
 * the SFX unlock; then `onEnter` runs the exit (lines sink back, logo dissolves, then the cinematic).
 */
export const EntryGate = ({ beat, out, onEnter }: { beat: number; out: number; onEnter: () => void }) => {
	const portrait = usePortraitWindow();
	const t = useT();
	const enter = () => {
		setMusicScene("lobby");
		unlockMusic();
		unlockAudio();
		onEnter();
	};

	return (
		<Stagger>
			<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, marginBottom: 18 }}>
				{/* Keyed by index: a language switch swaps the text in place instead of replaying the line. */}
				{VERSE_IDS.map((id, i) => (
					<InkLine key={i} shown={beat >= GATE_BEAT.firstLine + i && out < GATE_OUT.firstLine + i} nowrap={!portrait}>
						{t(id)}
					</InkLine>
				))}
			</div>
			<InkStrokeButton onClick={enter} variant={0} visible={beat >= GATE_BEAT.entra && out < GATE_OUT.entra}>
				{t("gate.enter")}
			</InkStrokeButton>
		</Stagger>
	);
};
