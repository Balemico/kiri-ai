import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useSession } from "../useSession";
import { useNetDiagnostics } from "../diagnostics";
import { InkLayer, LobbyScene } from "../../components/sections";
import { InkStrokeButton, Stagger } from "../../components/atoms";
import { INTRO } from "../../layout";
import { LAYOUT_TRANSITION } from "../../motionPresets";
import { Menu } from "./Menu";
import { MultiplayerLobby } from "./MultiplayerLobby";
import { BackStroke, HankoStamp, LobbyColumn } from "./ui";

// The cinematic plays once per app load — coming back from a game (or the multiplayer flow)
// re-enters a lobby that is already "awake".
let introPlayed = false;

// The DOM choreography has 3 beats: the logo (1), then the two menu strokes (2, 3); the caption
// under the strokes paints with the last beat.
const MENU_BEATS = 3;

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

/**
 * Screen wrapper: the column never blinks between lobby screens — the leaving screen's rows lift
 * away bottom-first and the arriving one's rows come in one after another (`Stagger`, inside each
 * screen; this wrapper adds no fade of its own, which would cut the cascade short).
 * Each CALL SITE must set a unique `key` — AnimatePresence diffs its direct children, so the key
 * has to live on the ScreenFade element itself for exits to run.
 */
const ScreenFade = ({ children }: { children: ReactNode }) => (
	<motion.div layout="position" transition={{ layout: LAYOUT_TRANSITION }} style={{ display: "flex", flexDirection: "column" }}>
		{children}
	</motion.div>
);

/**
 * Full-screen lobby (`status !== "playing"`): the living panorama behind, the ink-stroke menu in
 * the right column. First load plays the entry cinematic; a tap anywhere skips it (a tap on a
 * button ALSO activates it — the buttons are clickable as soon as they're visible).
 *
 * The DOM choreography is STATE-driven: a `beat` counter advances on the INTRO schedule (via
 * timeouts) and each element paints on when its beat is reached (hidden → painted is a
 * target-changing variant switch, which Motion animates immediately). A skip jumps `beat`
 * straight to the end — mount-scheduled `transition.delay`s would NOT work here, because a
 * changed delay never restarts a Motion animation that is already pending.
 */
export const Lobby = () => {
	const { status, roomKeyword, leave } = useSession();
	const [screen, setScreen] = useState<"root" | "mp">("root");
	const reduced = useReducedMotion();
	const [introDone, setIntroDone] = useState(() => introPlayed || !!reduced);
	const [beat, setBeat] = useState(() => (introPlayed || !!reduced ? MENU_BEATS : 0));
	const skip3D = useRef<() => void>(() => {});

	// Advance the beats on the INTRO schedule. Runs once when the intro starts; when introDone
	// flips (skip or natural end) the cleanup clears any pending timers and the early return
	// keeps them cleared — finishIntro has already jumped `beat` to the end.
	useEffect(() => {
		if (introDone) return;
		const timers = Array.from({ length: MENU_BEATS }, (_, i) =>
			window.setTimeout(() => setBeat((b) => Math.max(b, i + 1)), (INTRO.menuDelay + i * INTRO.menuStagger) * 1000),
		);
		return () => timers.forEach((t) => window.clearTimeout(t));
	}, [introDone]);

	// Stable identity so LobbyScene's register effect doesn't re-run on every Lobby render.
	const registerSkip = useCallback((fn: () => void) => {
		skip3D.current = fn;
	}, []);

	// Synchronously re-entrant: skip3D.current() makes LobbyScene fire onIntroEnd (= this function)
	// again in the same tick — it terminates because LobbyScene's done.current guard trips first.
	const finishIntro = useCallback(() => {
		introPlayed = true;
		skip3D.current();
		setIntroDone(true);
		setBeat(MENU_BEATS);
	}, []);

	const backToMenu = () => {
		leave();
		setScreen("root");
	};

	return (
		<div style={{ position: "fixed", inset: 0, zIndex: 3000, overflow: "hidden" }} onPointerDown={introDone ? undefined : finishIntro}>
			<LobbyScene intro={!introDone} registerSkip={registerSkip} onIntroEnd={finishIntro} reducedLeaves={!!reduced} />
			{/* Sumi strokes of the menu buttons — between the panorama and the column (DOM order). */}
			<InkLayer />

			<LobbyColumn>
				<motion.img
					// Re-centred when the screen below changes height: glide, never jump.
					layout="position"
					transition={{ layout: LAYOUT_TRANSITION }}
					src="/images/logo/kiri-ai-logo.png"
					alt="Kiri-ai: The Duel"
					variants={{
						hidden: { opacity: 0, y: -12, filter: "blur(6px)" },
						painted: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
					}}
					initial="hidden"
					animate={beat > 0 ? "painted" : "hidden"}
					style={{ width: "100%", alignSelf: "center", marginBottom: 10, filter: "drop-shadow(0 6px 18px rgba(0, 0, 0, 0.35))" }}
				/>

				<AnimatePresence mode="wait">
					{status === "menu" &&
						(screen === "root" ? (
							<ScreenFade key="root">
								<Menu onMultiplayer={() => setScreen("mp")} beat={beat} />
							</ScreenFade>
						) : (
							<ScreenFade key="mp">
								<MultiplayerLobby onBack={() => setScreen("root")} />
							</ScreenFade>
						))}

					{status === "waiting" && (
						<ScreenFade key="waiting">
							<Stagger>
								<p style={{ margin: 0, textAlign: "center", color: "#17120e", fontSize: 15, letterSpacing: 2 }}>
									In attesa… condividi la parola chiave
								</p>
								<HankoStamp>{roomKeyword}</HankoStamp>
								<p style={{ margin: 0, fontSize: 13, opacity: 0.65, textAlign: "center", color: "#17120e" }}>
									Non appena si unisce, la partita inizia.
								</p>
								<NetDiagLine />
								<BackStroke onClick={backToMenu}>ANNULLA</BackStroke>
							</Stagger>
						</ScreenFade>
					)}

					{status === "peer-left" && (
						<ScreenFade key="peer-left">
							<Stagger>
								<p style={{ margin: 0, textAlign: "center", color: "#17120e", fontSize: 17, letterSpacing: 2 }}>
									Avversario uscito — la partita è stata interrotta
								</p>
								<InkStrokeButton onClick={backToMenu} seal>
									TORNA AL MENU
								</InkStrokeButton>
							</Stagger>
						</ScreenFade>
					)}
				</AnimatePresence>
			</LobbyColumn>
		</div>
	);
};
