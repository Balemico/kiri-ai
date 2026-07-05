import { useState } from "react";
import type { Team } from "../../game";
import { useSession } from "../useSession";
import { Panel, InkButton, TextField } from "./ui";

type View = "choose" | "create" | "join";

const TEAM_LABEL: Record<Team, string> = { red: "ROSSO", blue: "BLU" };

/** Multiplayer lobby: create a room (keyword + colour) or join one (keyword → the other colour). */
export const MultiplayerLobby = ({ onBack }: { onBack: () => void }) => {
	const { createRoom, joinRoom } = useSession();
	const [view, setView] = useState<View>("choose");
	const [keyword, setKeyword] = useState("");
	const [color, setColor] = useState<Team>("red");

	const trimmed = keyword.trim();

	if (view === "choose") {
		return (
			<Panel title="Multiplayer" subtitle="Crea una partita o unisciti a una esistente">
				<InkButton tone="red" onClick={() => setView("create")}>
					CREA PARTITA
				</InkButton>
				<InkButton tone="blue" onClick={() => setView("join")}>
					UNISCITI
				</InkButton>
				<InkButton tone="ghost" onClick={onBack}>
					← INDIETRO
				</InkButton>
			</Panel>
		);
	}

	if (view === "create") {
		return (
			<Panel title="Crea partita" subtitle="Scegli una parola chiave e il tuo colore">
				<TextField value={keyword} onChange={setKeyword} placeholder="Parola chiave (es. duello)" onEnter={() => trimmed && createRoom(trimmed, color)} />
				<div style={{ display: "flex", gap: 10 }}>
					{(["red", "blue"] as Team[]).map((t) => (
						<InkButton key={t} tone={color === t ? t : "ghost"} onClick={() => setColor(t)}>
							{TEAM_LABEL[t]}
						</InkButton>
					))}
				</div>
				<InkButton disabled={!trimmed} onClick={() => createRoom(trimmed, color)}>
					CREA E ATTENDI
				</InkButton>
				<InkButton tone="ghost" onClick={() => setView("choose")}>
					← INDIETRO
				</InkButton>
			</Panel>
		);
	}

	return (
		<Panel title="Unisciti" subtitle="Inserisci la parola chiave della partita">
			<TextField value={keyword} onChange={setKeyword} placeholder="Parola chiave" onEnter={() => trimmed && joinRoom(trimmed)} />
			<p style={{ margin: 0, fontSize: 12, opacity: 0.6, textAlign: "center" }}>Ti verrà assegnato il colore opposto a chi ha creato la partita.</p>
			<InkButton disabled={!trimmed} onClick={() => joinRoom(trimmed)}>
				UNISCITI
			</InkButton>
			<InkButton tone="ghost" onClick={() => setView("choose")}>
				← INDIETRO
			</InkButton>
		</Panel>
	);
};
