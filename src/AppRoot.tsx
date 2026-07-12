import { useState } from "react";
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
export const AppRoot = () => {
	const { status, mode, specials, roomKeyword } = useSession();
	const reduced = !!useReducedMotion();
	const playing = status === "playing";
	const [covered, setCovered] = useState(false);
	const [sceneReady, setSceneReady] = useState(false);
	// Leaving the game (leave / peer-left) rearms the veil for the next session. Adjusted during
	// render (React's "state from props" pattern), NOT in an effect — this repo's eslint-plugin-
	// react-hooks forbids synchronous setState inside effects (see CLAUDE.md Gotchas).
	const [prevPlaying, setPrevPlaying] = useState(playing);
	if (playing !== prevPlaying) {
		setPrevPlaying(playing);
		if (!playing) {
			setCovered(false);
			setSceneReady(false);
		}
	}

	const showGame = playing && (covered || reduced);

	const config: EngineConfig = { firstPlayer: "red", ...(mode === "online" && specials ? { specials } : {}) };
	return (
		<>
			{!showGame && <Lobby />}
			{showGame && (
				// Remount the engine per session so a new game never inherits stale state.
				<GameProvider key={`${mode}-${roomKeyword ?? "local"}`} config={config}>
					<Scene entrance={reduced ? "none" : "fly"} onReady={() => setSceneReady(true)} />
				</GameProvider>
			)}
			{!reduced && <InkTransition covering={playing} release={sceneReady} onCovered={() => setCovered(true)} />}
		</>
	);
};
