import { useState } from "react";
import { useSession } from "../useSession";
import { useNetDiagnostics } from "../diagnostics";
import { Menu } from "./Menu";
import { MultiplayerLobby } from "./MultiplayerLobby";
import { Backdrop, Panel, InkButton } from "./ui";

/**
 * On-screen connection health for the waiting room — mobile has no console, so relay/TURN state
 * must be visible to debug PC↔mobile sessions. relay = Nostr signaling (peers can find each
 * other); the ICE label = whether a TURN relay is available for the WebRTC hop itself.
 */
const NetDiagLine = () => {
	const { ice, joinError, relays, rtc } = useNetDiagnostics();
	return (
		<p style={{ margin: 0, fontSize: 11, opacity: 0.55, textAlign: "center", letterSpacing: 1, lineHeight: 1.6 }}>
			relay {relays ? `${relays.open}/${relays.total}` : "…"} · {ice ?? "ICE…"} · rtc {rtc ?? "–"}
			{joinError && (
				<>
					<br />
					<span style={{ color: "#e08a7a", wordBreak: "break-all" }}>errore: {joinError}</span>
				</>
			)}
		</p>
	);
};

/**
 * Full-screen lobby shown whenever no game is mounted (`status !== "playing"`): mode select, the
 * multiplayer create/join flow, the "waiting for opponent" room, and the "opponent left" screen.
 */
export const Lobby = () => {
	const { status, roomKeyword, leave } = useSession();
	const [screen, setScreen] = useState<"root" | "mp">("root");

	// Leaving a room returns to the menu — reset to the root choice at the same time (no effect needed;
	// this is the only path back to `status === "menu"`).
	const backToMenu = () => {
		leave();
		setScreen("root");
	};

	return (
		<Backdrop>
			{status === "menu" &&
				(screen === "root" ? <Menu onMultiplayer={() => setScreen("mp")} /> : <MultiplayerLobby onBack={() => setScreen("root")} />)}

			{status === "waiting" && (
				<Panel title="In attesa…" subtitle="Condividi la parola chiave con l'avversario">
					<div
						style={{
							textAlign: "center",
							fontSize: 22,
							letterSpacing: 3,
							padding: "10px 0",
							fontFamily: "var(--font-display)",
							color: "#f0c26a",
						}}
					>
						{roomKeyword}
					</div>
					<p style={{ margin: 0, fontSize: 14, opacity: 0.7, textAlign: "center" }}>Non appena si unisce, la partita inizia.</p>
					<NetDiagLine />
					<InkButton tone="ghost" onClick={backToMenu}>
						ANNULLA
					</InkButton>
				</Panel>
			)}

			{status === "peer-left" && (
				<Panel title="Avversario uscito" subtitle="La partita è stata interrotta">
					<InkButton onClick={backToMenu}>TORNA AL MENU</InkButton>
				</Panel>
			)}
		</Backdrop>
	);
};
