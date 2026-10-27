import { useState } from "react";
import type { Team } from "../../game";
import { useSession } from "../useSession";
import { InkSegmentedStroke, InkStrokeButton, type InkSegmentOption } from "../../components/atoms";
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

/** Multiplayer lobby: create a room (keyword + colour) or join one (keyword → the other colour). */
export const MultiplayerLobby = ({ onBack }: { onBack: () => void }) => {
	const { createRoom, joinRoom } = useSession();
	const [view, setView] = useState<View>("choose");
	const [keyword, setKeyword] = useState("");
	const [color, setColor] = useState<Team>("red");

	const trimmed = keyword.trim();

	if (view === "choose") {
		return (
			<>
				<Heading title="Multiplayer" subtitle="Crea una partita o unisciti a una esistente" />
				<InkStrokeButton tone="red" variant={0} onClick={() => setView("create")}>
					CREA PARTITA
				</InkStrokeButton>
				<InkStrokeButton tone="blue" variant={1} onClick={() => setView("join")}>
					UNISCITI
				</InkStrokeButton>
				<BackStroke onClick={onBack}>← INDIETRO</BackStroke>
			</>
		);
	}

	if (view === "create") {
		return (
			<>
				<Heading title="Crea partita" subtitle="Scegli una parola chiave e il tuo colore" />
				<TextField value={keyword} onChange={setKeyword} placeholder="Parola chiave (es. duello)" onEnter={() => trimmed && createRoom(trimmed, color)} />
				{/* One stroke, two halves: the chosen colour lights its half, the other goes grey. */}
				<InkSegmentedStroke options={TEAM_OPTIONS} value={TEAMS.indexOf(color) as 0 | 1} onChange={(i) => setColor(TEAMS[i])} variant={1} />
				<InkStrokeButton disabled={!trimmed} seal onClick={() => createRoom(trimmed, color)}>
					CREA E ATTENDI
				</InkStrokeButton>
				<BackStroke onClick={() => setView("choose")}>← INDIETRO</BackStroke>
			</>
		);
	}

	return (
		<>
			<Heading title="Unisciti" subtitle="Inserisci la parola chiave della partita" />
			<TextField value={keyword} onChange={setKeyword} placeholder="Parola chiave" onEnter={() => trimmed && joinRoom(trimmed)} />
			<p style={{ margin: 0, fontSize: 12, opacity: 0.6, textAlign: "center", color: "#17120e" }}>
				Ti verrà assegnato il colore opposto a chi ha creato la partita.
			</p>
			<InkStrokeButton disabled={!trimmed} seal onClick={() => joinRoom(trimmed)}>
				UNISCITI
			</InkStrokeButton>
			<BackStroke onClick={() => setView("choose")}>← INDIETRO</BackStroke>
		</>
	);
};
