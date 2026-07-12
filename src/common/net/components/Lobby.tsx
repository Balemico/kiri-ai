import { useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useSession } from "../useSession";
import { useNetDiagnostics } from "../diagnostics";
import { LobbyScene } from "../../components/sections";
import { InkStrokeButton } from "../../components/atoms";
import { INTRO } from "../../layout";
import { Menu } from "./Menu";
import { MultiplayerLobby } from "./MultiplayerLobby";
import { HankoStamp, LobbyColumn } from "./ui";

// The cinematic plays once per app load — coming back from a game (or the multiplayer flow)
// re-enters a lobby that is already "awake".
let introPlayed = false;

/** On-screen connection health (mobile has no console) — unchanged behaviour, restyled for paper. */
const NetDiagLine = () => {
	const { ice, joinError, relays, rtc } = useNetDiagnostics();
	return (
		<p style={{ margin: 0, fontSize: 11, opacity: 0.5, textAlign: "center", letterSpacing: 1, lineHeight: 1.6, color: "#17120e" }}>
			relay {relays ? `${relays.open}/${relays.total}` : "…"} · {ice ?? "ICE…"} · rtc {rtc ?? "–"}
			{joinError && (
				<>
					<br />
					<span style={{ color: "#b73225", wordBreak: "break-all" }}>errore: {joinError}</span>
				</>
			)}
		</p>
	);
};

/** Shared cross-fade wrapper: every lobby screen slides/fades in the SAME column — the panorama never blinks. */
const ScreenFade = ({ children, id }: { children: ReactNode; id: string }) => (
	<motion.div
		key={id}
		initial={{ opacity: 0, y: 14 }}
		animate={{ opacity: 1, y: 0 }}
		exit={{ opacity: 0, y: -10 }}
		transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
		style={{ display: "flex", flexDirection: "column", gap: 16 }}
	>
		{children}
	</motion.div>
);

/**
 * Full-screen lobby (`status !== "playing"`): the living panorama behind, the ink-stroke menu in
 * the right column. First load plays the entry cinematic; a tap anywhere skips it (a tap on a
 * button ALSO activates it — the buttons are clickable as soon as they're visible).
 */
export const Lobby = () => {
	const { status, roomKeyword, leave } = useSession();
	const [screen, setScreen] = useState<"root" | "mp">("root");
	const reduced = useReducedMotion();
	const [introDone, setIntroDone] = useState(() => introPlayed || !!reduced);
	const skip3D = useRef<() => void>(() => {});

	const finishIntro = useCallback(() => {
		introPlayed = true;
		skip3D.current();
		setIntroDone(true);
	}, []);

	// DOM elements pick their paint-on delay from the intro beat map — 0 once the intro is over.
	const delayFor = (i: number) => (introDone ? 0 : INTRO.menuDelay + i * INTRO.menuStagger);

	const backToMenu = () => {
		leave();
		setScreen("root");
	};

	return (
		<div style={{ position: "fixed", inset: 0, zIndex: 3000, overflow: "hidden" }} onPointerDown={introDone ? undefined : finishIntro}>
			<LobbyScene intro={!introDone} registerSkip={(fn) => (skip3D.current = fn)} onIntroEnd={finishIntro} reducedLeaves={!!reduced} />

			{/* Calligraphy watermark behind the column (landscape flavour; harmless in portrait). */}
			<motion.img
				src="/images/intro/calligraphy.png"
				alt=""
				initial={{ opacity: 0, clipPath: "inset(0 0 100% 0)" }}
				animate={{ opacity: 0.15, clipPath: "inset(0 0 0% 0)" }}
				transition={{ delay: delayFor(0), duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
				style={{ position: "absolute", right: "30%", top: "6%", height: "70%", pointerEvents: "none" }}
			/>

			<LobbyColumn>
				<motion.img
					src="/images/logo/kiri-ai-logo.png"
					alt="Kiri-ai: The Duel"
					initial={{ opacity: 0, y: -12, filter: "blur(6px)" }}
					animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
					transition={{ delay: delayFor(1), duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
					style={{ width: "82%", alignSelf: "center", filter: "drop-shadow(0 6px 18px rgba(0, 0, 0, 0.35))" }}
				/>

				<AnimatePresence mode="wait">
					{status === "menu" &&
						(screen === "root" ? (
							<ScreenFade id="root">
								<Menu onMultiplayer={() => setScreen("mp")} delayFor={delayFor} />
							</ScreenFade>
						) : (
							<ScreenFade id="mp">
								<MultiplayerLobby onBack={() => setScreen("root")} />
							</ScreenFade>
						))}

					{status === "waiting" && (
						<ScreenFade id="waiting">
							<p style={{ margin: 0, textAlign: "center", color: "#17120e", fontSize: 15, letterSpacing: 2 }}>
								In attesa… condividi la parola chiave
							</p>
							<HankoStamp>{roomKeyword}</HankoStamp>
							<p style={{ margin: 0, fontSize: 13, opacity: 0.65, textAlign: "center", color: "#17120e" }}>
								Non appena si unisce, la partita inizia.
							</p>
							<NetDiagLine />
							<InkStrokeButton tone="ghost" variant={2} onClick={backToMenu}>
								ANNULLA
							</InkStrokeButton>
						</ScreenFade>
					)}

					{status === "peer-left" && (
						<ScreenFade id="peer-left">
							<p style={{ margin: 0, textAlign: "center", color: "#17120e", fontSize: 17, letterSpacing: 2 }}>
								Avversario uscito — la partita è stata interrotta
							</p>
							<InkStrokeButton onClick={backToMenu} seal>
								TORNA AL MENU
							</InkStrokeButton>
						</ScreenFade>
					)}
				</AnimatePresence>
			</LobbyColumn>
		</div>
	);
};
