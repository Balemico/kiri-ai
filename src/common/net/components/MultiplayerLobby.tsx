import { useState } from "react";
import { AnimatePresence } from "motion/react";
import type { Team } from "../../game";
import { useSession } from "../useSession";
import { InkSegmentedStroke, InkStrokeButton, Stagger, type InkSegmentOption } from "../../components/atoms";
import { BackStroke, TextField } from "./ui";

type View = "choose" | "create" | "join";

const TEAMS: [Team, Team] = ["red", "blue"];
// Module constant: a stable identity, so the toggle doesn't re-register its stroke every render.
const TEAM_OPTIONS: [InkSegmentOption, InkSegmentOption] = [
	{ label: "ROSSO", tone: "red" },
	{ label: "BLU", tone: "blue" },
];

const Heading = ({ title, subtitle }: { title: string; subtitle: string }) => (
	<div style={{ textAlign: "center", color: "#17120e", marginBottom: 10 }}>
		<h1 style={{ margin: 0, fontSize: 28, letterSpacing: 4, fontFamily: "var(--font-display)" }}>{title}</h1>
		<p style={{ margin: "6px 0 0", fontSize: 13, opacity: 0.65 }}>{subtitle}</p>
	</div>
);

/**
 * Multiplayer lobby: create a room (keyword + colour) or join one (keyword → the other colour).
 * Each view is a `Stagger` keyed by the view: switching lets the old view lift away, then the new
 * rows — and their ink strokes — arrive one after another. Keyword and colour live here, above
 * the keyed views, so they survive switching between them.
 */
export const MultiplayerLobby = ({ onBack }: { onBack: () => void }) => {
	const { createRoom, joinRoom } = useSession();
	const [view, setView] = useState<View>("choose");
	const [keyword, setKeyword] = useState("");
	const [color, setColor] = useState<Team>("red");

	const trimmed = keyword.trim();

	return (
		// `propagate`: when the whole multiplayer screen leaves (outer AnimatePresence in Lobby), the
		// current view's rows still run their exit cascade instead of vanishing.
		<AnimatePresence mode="wait" propagate>
			{view === "choose" && (
				<Stagger key="choose">
					<Heading title="Multiplayer" subtitle="Crea una partita o unisciti a una esistente" />
					<InkStrokeButton tone="red" variant={0} onClick={() => setView("create")}>
						CREA PARTITA
					</InkStrokeButton>
					<InkStrokeButton tone="blue" variant={1} onClick={() => setView("join")}>
						UNISCITI
					</InkStrokeButton>
					<BackStroke onClick={onBack}>← INDIETRO</BackStroke>
				</Stagger>
			)}

			{view === "create" && (
				<Stagger key="create">
					<Heading title="Crea partita" subtitle="Scegli una parola chiave e il tuo colore" />
					<TextField value={keyword} onChange={setKeyword} placeholder="Parola chiave (es. duello)" onEnter={() => trimmed && createRoom(trimmed, color)} />
					{/* One stroke, two halves: the chosen colour lights its half, the other goes grey. */}
					<InkSegmentedStroke options={TEAM_OPTIONS} value={TEAMS.indexOf(color) as 0 | 1} onChange={(i) => setColor(TEAMS[i])} variant={1} />
					<InkStrokeButton disabled={!trimmed} seal onClick={() => createRoom(trimmed, color)}>
						CREA E ATTENDI
					</InkStrokeButton>
					<BackStroke onClick={() => setView("choose")}>← INDIETRO</BackStroke>
				</Stagger>
			)}

			{view === "join" && (
				<Stagger key="join">
					<Heading title="Unisciti" subtitle="Inserisci la parola chiave della partita" />
					<TextField value={keyword} onChange={setKeyword} placeholder="Parola chiave" onEnter={() => trimmed && joinRoom(trimmed)} />
					<p style={{ margin: 0, fontSize: 12, opacity: 0.6, textAlign: "center", color: "#17120e" }}>
						Ti verrà assegnato il colore opposto a chi ha creato la partita.
					</p>
					<InkStrokeButton disabled={!trimmed} seal onClick={() => joinRoom(trimmed)}>
						UNISCITI
					</InkStrokeButton>
					<BackStroke onClick={() => setView("choose")}>← INDIETRO</BackStroke>
				</Stagger>
			)}
		</AnimatePresence>
	);
};
