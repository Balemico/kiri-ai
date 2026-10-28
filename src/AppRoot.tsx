import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { GameProvider } from "./common/state";
import { Scene, InkTransition } from "./common/components/sections";
import { useSession, Lobby } from "./common/net";
import type { EngineConfig } from "./common/game";

/**
 * Gate between the lobby and the game. The swap happens UNDER the ink veil: when the session
 * starts, strokes cover the screen (`onCovered` → the lobby unmounts, the engine mounts), the
 * veil holds until the scene has rendered a frame, then dries out over the fly-back reveal.
 * Reduced motion: no veil, no flight — the swap is immediate, as before.
 */
/** Longest the veil waits, once covered, for the duel to report it renders smoothly. */
const READY_TIMEOUT_MS = 3500;

export const AppRoot = () => {
	const { status, mode, specials, roomKeyword } = useSession();
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
	const onVeilCovered = () => {
		if (rematch === "cover") {
			setMatch((m) => m + 1);
			setSceneReady(false);
			setForceRelease(false);
			setRematch("idle");
		} else if (playingRef.current) setCovered(true);
	};

	const config: EngineConfig = { firstPlayer: "red", ...(mode === "online" && specials ? { specials } : {}) };
	return (
		<>
			{!showGame && <Lobby />}
			{showGame && (
				// Remount the engine per session so a new game never inherits stale state.
				<GameProvider key={`${mode}-${roomKeyword ?? "local"}-${match}`} config={config} onRematch={requestRematch}>
					<Scene entrance={reduced ? "none" : "fly"} onReady={() => setSceneReady(true)} />
				</GameProvider>
			)}
			{/* Guarded on the LIVE session (ref): see the leave-during-cover race note above. */}
			{!reduced && (
				<InkTransition
					covering={playing && rematch !== "rearm"}
					// Held during a rematch: the OLD scene is still "ready" while the veil covers it, and a
					// release seen at the moment of cover would start drying over the old duel.
					release={(sceneReady || forceRelease) && rematch === "idle"}
					onCovered={onVeilCovered}
				/>
			)}
		</>
	);
};
