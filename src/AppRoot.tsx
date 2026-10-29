import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { GameProvider } from "./common/state";
import { Scene, InkTransition } from "./common/components/sections";
import { useSession, Lobby } from "./common/net";
import type { EngineConfig } from "./common/game";
import { useMusicControls } from "./common/hooks/useMusicControls";
import { setMusicScene, type MusicScene } from "./common/music";
import { useEntered } from "./common/state/entryGate";
import { useShowdown } from "./common/state/duelMusic";
import { useVictoryShown } from "./common/state/victoryReveal";

/**
 * Gate between the lobby and the game. The swap happens UNDER the ink veil: when the session
 * starts, strokes cover the screen (`onCovered` → the lobby unmounts, the engine mounts), the
 * veil holds until the scene has rendered a frame, then dries out over the fly-back reveal.
 * Reduced motion: no veil, no flight — the swap is immediate, as before.
 */
/** Longest the veil waits, once covered, for the duel to report it renders smoothly. */
const READY_TIMEOUT_MS = 3500;
/** Leaving the duel: how long the veil holds over the freshly mounted lobby before drying out. */
const LOBBY_SETTLE_MS = 600;

export const AppRoot = () => {
	const { status, mode, specials, roomKeyword, leave } = useSession();
	const reduced = !!useReducedMotion();
	const playing = status === "playing";
	const [covered, setCovered] = useState(false);
	const [sceneReady, setSceneReady] = useState(false);
	// Any transition of `playing` (either direction) rearms the veil for the next session — so a
	// theoretically-stale `covered=true` can never leak into a new session. Adjusted during render
	// (React's "state from props" pattern), NOT in an effect — this repo's eslint-plugin-react-hooks
	// forbids synchronous setState inside effects (see CLAUDE.md Gotchas).
	const [prevPlaying, setPrevPlaying] = useState(playing);
	if (playing !== prevPlaying) {
		setPrevPlaying(playing);
		setCovered(false);
		setSceneReady(false);
	}
	// Leave-during-cover race: an in-flight seal animation completing AFTER `playing` flipped false
	// must never set `covered` back to true (it would make the NEXT session skip the veil). The ref
	// mirrors the live value (written in an effect — render-time ref writes are lint-forbidden), and
	// the callback below guards on it rather than on a possibly-stale closure capture.
	const playingRef = useRef(playing);
	useEffect(() => {
		playingRef.current = playing;
	}, [playing]);

	const showGame = playing && (covered || reduced);

	// Safety net: the reveal must never hang on the scene's "ready" signal (it relies on the duel
	// canvas producing frames — a lost GPU context or a very slow device would stall it forever).
	// A wall-clock timeout releases the veil anyway. setState only inside the timer callback.
	const [forceRelease, setForceRelease] = useState(false);
	if (!showGame && forceRelease) setForceRelease(false);
	useEffect(() => {
		if (!showGame || sceneReady) return;
		const t = window.setTimeout(() => setForceRelease(true), READY_TIMEOUT_MS);
		return () => window.clearTimeout(t);
	}, [showGame, sceneReady]);

	// Local rematch ("NUOVA PARTITA"): replay the entrance instead of resetting in place. The veil is
	// re-armed (covering drops for a beat), slashes in again, and on full cover the engine + scene are
	// remounted fresh (`match` in the key) — so the new duel opens exactly like the first: approach,
	// samurai standing up, HUD, hand. Reduced motion: just the remount.
	const [match, setMatch] = useState(0);
	const [rematch, setRematch] = useState<"idle" | "rearm" | "cover">("idle");
	const requestRematch = () => {
		if (rematch !== "idle") return;
		if (reduced) {
			setMatch((m) => m + 1);
			return;
		}
		setRematch("rearm");
		// One committed frame with the veil idle re-arms it; the timer callback then starts the cover.
		window.setTimeout(() => setRematch("cover"), 60);
	};
	// Leaving the duel (MENU after the victory, ESCI from the quit dialog, online RESET_GAME): the same
	// change of view in reverse. The veil is re-armed and slashes in over the duel; on full cover the
	// session leaves (the lobby mounts underneath, its intro already played, so fully painted) and the
	// veil holds (`reveal`) until the lobby has settled, then dries over it (`dry`) and goes idle once
	// the ink is gone. Reduced motion: at once.
	const [exit, setExit] = useState<"idle" | "rearm" | "cover" | "reveal" | "dry">("idle");
	const requestLeave = () => {
		if (exit !== "idle" || rematch !== "idle") return;
		if (reduced) {
			leave();
			return;
		}
		setExit("rearm");
		window.setTimeout(() => setExit((e) => (e === "rearm" ? "cover" : e)), 60);
	};
	// The session ended on its own before the veil covered (online: the opponent left) — drop the leave.
	if (!playing && (exit === "rearm" || exit === "cover")) setExit("idle");
	useEffect(() => {
		if (exit !== "reveal") return;
		const t = window.setTimeout(() => setExit("dry"), LOBBY_SETTLE_MS);
		return () => window.clearTimeout(t);
	}, [exit]);
	const onVeilCovered = () => {
		if (exit === "cover") {
			leave();
			setExit("reveal");
		} else if (rematch === "cover") {
			setMatch((m) => m + 1);
			setSceneReady(false);
			setForceRelease(false);
			setRematch("idle");
		} else if (playingRef.current) setCovered(true);
	};

	// Background music follows the session, not the mounted view: the lobby → battle crossfade starts
	// as the veil slashes in, so the swap happens under the ink. A rematch (`match`) draws a new track.
	// Within a duel the mood escalates: both on their last life → showdown; the victory screen → end.
	// Silent until the lobby's entry gate is passed (its ENTRA tap starts the lobby track itself, inside
	// the gesture — this effect then sees the same scene and is a no-op).
	useMusicControls();
	const entered = useEntered();
	const showdown = useShowdown();
	const victory = useVictoryShown();
	const duelScene: MusicScene = victory ? "end" : showdown ? "showdown" : "battle";
	useEffect(() => {
		if (entered) setMusicScene(playing ? duelScene : "lobby", playing ? String(match) : "");
	}, [entered, playing, match, duelScene]);

	const config: EngineConfig ={ firstPlayer: "red", ...(mode === "online" && specials ? { specials } : {}) };
	return (
		<>
			{!showGame && <Lobby />}
			{showGame && (
				// Remount the engine per session so a new game never inherits stale state.
				<GameProvider key={`${mode}-${roomKeyword ?? "local"}-${match}`} config={config} onRematch={requestRematch} onLeave={requestLeave}>
					<Scene entrance={reduced ? "none" : "fly"} onReady={() => setSceneReady(true)} />
				</GameProvider>
			)}
			{/* Guarded on the LIVE session (ref): see the leave-during-cover race note above. */}
			{!reduced && (
				<InkTransition
					// Leaving keeps it covering past the end of the session, over the lobby, until it dries.
					covering={(playing && rematch !== "rearm" && exit !== "rearm") || exit === "reveal" || exit === "dry"}
					// Held during a rematch / a leave: the OLD scene is still "ready" while the veil covers it,
					// and a release seen at the moment of cover would start drying over the old duel.
					release={exit === "dry" || ((sceneReady || forceRelease) && rematch === "idle" && exit === "idle")}
					onCovered={onVeilCovered}
					onDone={() => {
						if (exit === "dry") setExit("idle");
					}}
				/>
			)}
			{/* The lobby under a drying veil takes no taps: a session started before the ink is gone
			    would find the veil mid-session and never cover. */}
			{exit !== "idle" && <div style={{ position: "fixed", inset: 0, zIndex: 4001 }} />}
		</>
	);
};
