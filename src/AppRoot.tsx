import { GameProvider } from "./common/state";
import { Scene } from "./common/components/sections";
import { useSession, Lobby } from "./common/net";
import type { EngineConfig } from "./common/game";

/**
 * Gate between the lobby and the game. While no game is running (`status !== "playing"`) the lobby
 * overlay is shown; once a session starts the engine is mounted. Online, both clients build an
 * IDENTICAL initial state from the shared `specials`; local pass & play uses a fresh random deal.
 */
export const AppRoot = () => {
	const { status, mode, specials, roomKeyword } = useSession();

	if (status !== "playing") return <Lobby />;

	const config: EngineConfig = { firstPlayer: "red", ...(mode === "online" && specials ? { specials } : {}) };
	// Remount the engine per session so a new game never inherits stale state.
	return (
		<GameProvider key={`${mode}-${roomKeyword ?? "local"}`} config={config}>
			<Scene />
		</GameProvider>
	);
};
