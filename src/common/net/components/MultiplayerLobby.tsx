import { useState } from "react";
import type { Team } from "../../game";
import { useSession } from "../useSession";
import { InkStrokeButton } from "../../components/atoms";
import { TextField } from "./ui";

type View = "choose" | "create" | "join";

const TEAM_LABEL: Record<Team, string> = { red: "ROSSO", blue: "BLU" };

const Heading = ({ title, subtitle }: { title: string; subtitle: string }) => (
	<div style={{ textAlign: "center", color: "#17120e" }}>
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
				<InkStrokeButton tone="ghost" variant={2} onClick={onBack}>
					← INDIETRO
				</InkStrokeButton>
			</>
		);
	}

	if (view === "create") {
		return (
			<>
				<Heading title="Crea partita" subtitle="Scegli una parola chiave e il tuo colore" />
				<TextField value={keyword} onChange={setKeyword} placeholder="Parola chiave (es. duello)" onEnter={() => trimmed && createRoom(trimmed, color)} />
				<div style={{ display: "flex", gap: 10 }}>
					{(["red", "blue"] as Team[]).map((t) => (
						<InkStrokeButton key={t} tone={color === t ? t : "ghost"} variant={t === "red" ? 0 : 1} onClick={() => setColor(t)}>
							{TEAM_LABEL[t]}
						</InkStrokeButton>
					))}
				</div>
				<InkStrokeButton disabled={!trimmed} seal onClick={() => createRoom(trimmed, color)}>
					CREA E ATTENDI
				</InkStrokeButton>
				<InkStrokeButton tone="ghost" variant={2} onClick={() => setView("choose")}>
					← INDIETRO
				</InkStrokeButton>
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
			<InkStrokeButton tone="ghost" variant={2} onClick={() => setView("choose")}>
				← INDIETRO
			</InkStrokeButton>
		</>
	);
};
