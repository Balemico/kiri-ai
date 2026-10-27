import { useState } from "react";
import { isActing, useGame } from "../state";
import { useDuelIntroReached } from "../state/duelIntro";
import { useSession } from "../net";
import { useHandoffPending } from "./useHandoffPending";
import type { Team } from "../game";

export type ActingTeams = Record<Team, boolean>;

const NONE: ActingTeams = { red: false, blue: false };

/**
 * Which teams the HUD shows as acting (turn highlight: banner underline, corner vignette). Nobody acts
 * before the duel opening has reached the first turn. While a pass & play hand-over is pending it
 * HOLDS the last value shown, so the highlight moves to the next team only once the veil has been
 * tapped away. Held via "state from props" during render (no effect).
 */
export const useActingTeams = (): ActingTeams => {
	const { state } = useGame();
	const { mode, viewerTeam } = useSession();
	const pending = useHandoffPending();
	const turnOpen = useDuelIntroReached("turn");
	const local = mode === "local";
	const red = turnOpen && isActing(state, "red", local, viewerTeam);
	const blue = turnOpen && isActing(state, "blue", local, viewerTeam);

	const [shown, setShown] = useState<ActingTeams>(NONE);
	if (!pending && (shown.red !== red || shown.blue !== blue)) setShown({ red, blue });
	return pending ? shown : { red, blue };
};
