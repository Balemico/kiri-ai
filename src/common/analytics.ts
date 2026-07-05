import { track } from "@vercel/analytics";

export type AnalyticsGameMode = "passplay" | "multiplayer";

/** Fired when a game session actually starts (not when browsing the lobby). */
export const trackGameMode = (mode: AnalyticsGameMode) => {
	track("mode", { mode });
};
