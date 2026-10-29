import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useSession } from "../useSession";
import type { SessionStatus } from "../types";
import { useNetDiagnostics } from "../diagnostics";
import { InkLayer, LobbyScene } from "../../components/sections";
import { InkStrokeButton, Stagger } from "../../components/atoms";
import { ENTRY_GATE, INTRO } from "../../layout";
import { EASE_IN, EASE_OUT, LAYOUT_TRANSITION } from "../../motionPresets";
import { Menu } from "./Menu";
import { MultiplayerLobby } from "./MultiplayerLobby";
import { BackStroke, HankoStamp, LobbyColumn, SoundCorner, usePortraitWindow } from "./ui";
import { EntryGate } from "./EntryGate";
import { GATE_BEAT, GATE_OUT, useGateBeats, useGateExit } from "./gateBeats";
import { entryGate, useEntered } from "../../state/entryGate";
import { useT } from "../../i18n";

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
	const t = useT();
	// The screen the column shows. "playing" has no screen of its own: the last one STAYS while the
	// veil slashes in over it — removing it would shrink the vertically-centred column and the logo
	// would jump down (an exit with nothing entering re-renders no layout component, so Motion has no
	// snapshot to glide from). Adjusted during render (state-from-props), not in an effect.
	const [view, setView] = useState<Exclude<SessionStatus, "playing">>(status === "playing" ? "menu" : status);
	if (status !== "playing" && status !== view) setView(status);
	const [screen, setScreen] = useState<"root" | "mp">("root");
	const reduced = useReducedMotion();
	const [introDone, setIntroDone] = useState(() => introPlayed || !!reduced);
	const [beat, setBeat] = useState(() => (introPlayed || !!reduced ? MENU_BEATS : 0));
	const skip3D = useRef<() => void>(() => {});
	const portrait = usePortraitWindow();
	// Entry gate (once per app load): the logo + ENTRA + audio switch on bare paper; the cinematic
	// (3D timeline + DOM beats) waits for the ENTRA tap — the gesture that lets the music play.
	const entered = useEntered();
	// Opened on the gate: the logo is already painted there and stays through the cinematic.
	const [gated] = useState(() => !entryGate.isEntered());
	// The gate's own clocks: the opening (bare paper → logo → lift → verse → ENTRA → audio icon) and
	// the ENTRA exit (lines sink back → logo dissolves → the gate opens: the cinematic starts).
	const gateBeat = useGateBeats(gated && !entered);
	const gateExit = useGateExit(entryGate.enter);

	// Advance the beats on the INTRO schedule. Runs once when the intro starts; when introDone
	// flips (skip or natural end) the cleanup clears any pending timers and the early return
	// keeps them cleared — finishIntro has already jumped `beat` to the end.
	useEffect(() => {
		if (introDone || !entered) return;
		const timers = Array.from({ length: MENU_BEATS }, (_, i) =>
			window.setTimeout(() => setBeat((b) => Math.max(b, i + 1)), (INTRO.menuDelay + i * INTRO.menuStagger) * 1000),
		);
		return () => timers.forEach((t) => window.clearTimeout(t));
	}, [introDone, entered]);

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
		<div style={{ position: "fixed", inset: 0, zIndex: 3000, overflow: "hidden" }} onPointerDown={introDone || !entered ? undefined : finishIntro}>
			<LobbyScene intro={!introDone} hold={!entered} registerSkip={registerSkip} onIntroEnd={finishIntro} reducedLeaves={!!reduced} paused={status === "playing"} />
			{/* Sumi strokes of the menu buttons — between the panorama and the column (DOM order). */}
			<InkLayer />

			<LobbyColumn centered={!entered}>
				{/* The FULL LOGO, gate and lobby alike: the box-art emblem (samurai cut out of a brushed red sun
				    — the cover's white shapes traced as ink, public/images/logo/kiri-ai-emblem.svg) over the
				    title, as ONE block. Gate: it appears centred (alone in the column), then glides up as the
				    verse's room opens under it (layout). ENTRA: it dissolves scaling down; the column moves to
				    its menu place while it's invisible; it returns there on the menu's first beat, growing back
				    from the same scale. A lobby opened without the gate paints it with that same beat. */}
				<motion.div
					layout="position"
					transition={{ layout: entered ? LAYOUT_TRANSITION : { duration: ENTRY_GATE.liftDur, ease: EASE_OUT } }}
					variants={{
						hidden: { opacity: 0, scale: ENTRY_GATE.logoScale, filter: "blur(8px)", transition: { duration: ENTRY_GATE.logoOutDur, ease: EASE_IN } },
						shown: { opacity: 1, scale: 1, filter: "blur(0px)", transition: { duration: entered ? ENTRY_GATE.logoInDur : ENTRY_GATE.logoDur, ease: EASE_OUT } },
					}}
					initial="hidden"
					animate={(entered ? beat > 0 : gateBeat >= GATE_BEAT.logo && gateExit.out < GATE_OUT.logo) ? "shown" : "hidden"}
					// Portrait lobby: logo at the top (on the sky), the panorama pulled up right under it
					// (LobbyScene / LOBBY.portrait), the menu centred in the space below. The gate stacks
					// everything centred (no auto margins) in both orientations.
					style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: portrait && entered ? "auto" : 10 }}
				>
					<img
						src="/images/logo/kiri-ai-emblem.svg"
						alt=""
						style={{
							// Portrait lobby: smaller (it sits at the top, over the panorama) — swapped while hidden.
							height: portrait ? (entered ? ENTRY_GATE.emblemHeightPortraitLobby : ENTRY_GATE.emblemHeightPortrait) : ENTRY_GATE.emblemHeight,
							marginBottom: ENTRY_GATE.emblemGap,
						}}
					/>
					<img src="/images/logo/kiri-ai-logo.png" alt="Kiri-ai: The Duel" style={{ width: "100%", filter: "drop-shadow(0 6px 18px rgba(0, 0, 0, 0.35))" }} />
				</motion.div>

				<AnimatePresence mode="wait">
					{/* Mounted from the lift beat: its arrival opens the verse's room and the logo rises. */}
					{!entered && gateBeat >= GATE_BEAT.lift && (
						<ScreenFade key="gate">
							<EntryGate beat={gateBeat} out={gateExit.out} onEnter={gateExit.start} />
						</ScreenFade>
					)}

					{entered &&
						view === "menu" &&
						(screen === "root" ? (
							<ScreenFade key="root">
								<Menu onMultiplayer={() => setScreen("mp")} beat={beat} />
							</ScreenFade>
						) : (
							<ScreenFade key="mp">
								<MultiplayerLobby onBack={() => setScreen("root")} />
							</ScreenFade>
						))}

					{view === "waiting" && (
						<ScreenFade key="waiting">
							<Stagger gap={12}>
								<p style={{ margin: 0, textAlign: "center", color: "#17120e", fontSize: 15, letterSpacing: 2 }}>
									{t("mp.waitingShare")}
								</p>
								<div style={{ display: "flex", justifyContent: "center", margin: "10px 0" }}>
									<HankoStamp>{roomKeyword}</HankoStamp>
								</div>
								<p style={{ margin: 0, fontSize: 13, opacity: 0.65, textAlign: "center", color: "#17120e" }}>
									{t("mp.waitingNote")}
								</p>
								<NetDiagLine />
								<BackStroke onClick={backToMenu}>{t("mp.cancel")}</BackStroke>
							</Stagger>
						</ScreenFade>
					)}

					{view === "peer-left" && (
						<ScreenFade key="peer-left">
							<Stagger>
								<p style={{ margin: 0, textAlign: "center", color: "#17120e", fontSize: 17, letterSpacing: 2 }}>
									{t("mp.peerLeft")}
								</p>
								<InkStrokeButton onClick={backToMenu}>
									{t("mp.backToMenu")}
								</InkStrokeButton>
							</Stagger>
						</ScreenFade>
					)}
				</AnimatePresence>
				{/* Portrait: the matching auto margin below, so the screen centres in the space under the logo —
				    which lands it just below the panorama's mountains, clear of the tree's canopy. */}
				{portrait && entered && <div style={{ marginTop: "auto" }} />}
			</LobbyColumn>
			{/* One audio control for gate + lobby, bottom-left. On the gate it is the last beat of the
			    opening and simply stays; a lobby without the gate paints it with the menu's last beat. */}
			<SoundCorner visible={gated ? gateBeat >= GATE_BEAT.audio : beat >= MENU_BEATS} />
		</div>
	);
};
