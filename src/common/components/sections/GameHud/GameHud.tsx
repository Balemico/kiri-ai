import { motion } from "motion/react";
import { PlayerBanner, RoundMarker } from "../../molecules";
import { useGame } from "../../../state";
import { useActingTeams } from "../../../hooks/useActingTeams";
import { useDuelIntroReached } from "../../../state/duelIntro";
import { useHitPreviewTick } from "../../../state/hitPreview";
import { useSession } from "../../../net";
import { useLagged } from "../../../hooks/useLagged";
import { useIsPortrait } from "../../../hooks/useIsPortrait";
import { useGameHudControls } from "../../../hooks/useGameHudControls";
import { MAX_HITS, type GameState, type Team, type TurnPhase } from "../../../game";

/** Leva "▶ Play hit": how long the previewed broken seal stays cracked before it mends (ms). */
const PREVIEW_MEND_MS = 2600;
/** Leva "▶ Play hit": beat between the press and the seal cracking (ms). */
const PREVIEW_STRIKE_MS = 120;

const PHASE_CAPTION: Record<TurnPhase, string | null> = {
	place: "SCELTA DELLE CARTE",
	ready: "SI SCOPRONO LE CARTE",
	"reveal-first": "PRIMA AZIONE",
	"reveal-second": "SECONDA AZIONE",
	"round-end": "FINE ROUND",
	"game-over": "FINE DEL DUELLO",
};

const captionFor = (state: GameState, team: Team, local: boolean, viewerTeam: Team): string | null => {
	if (state.phase === "game-over") return state.winner === team ? "VINCITORE" : null;
	if (state.phase !== "place") return null;
	if (state.confirmed[team]) return "PRONTO";
	// Whose turn it is reads from the corner vignette glowing in the team colour — no caption.
	return local || team === viewerTeam ? null : "STA SCEGLIENDO";
};

/**
 * The in-game HUD: red's banner top-left, blue's top-right, the round ensō between them. Purely a
 * read-out (pointer-events off), so it never steals a drag from the hand. Life seals and stance lag
 * the engine by `hitLagMs`: damage is applied at reveal, but the seal should break when the blade
 * lands on screen, not before the pawns have moved.
 */
export const GameHud = () => {
	const { state } = useGame();
	const { mode, viewerTeam } = useSession();
	const hud = useGameHudControls();
	const portrait = useIsPortrait();
	const local = mode === "local";
	// Turn highlight, held through a pass & play hand-over until the veil is tapped away.
	const acting = useActingTeams();
	const hudIn = useDuelIntroReached("hud");
	const scale = portrait ? hud.portraitScale : hud.scale;

	const redDamage = useLagged(state.red.damage, hud.hitLagMs);
	const blueLagged = useLagged(state.blue.damage, hud.hitLagMs);
	// Leva "▶ Play hit" (struck on blue): blue's next seal cracks right away, and mends again a couple
	// of seconds later so it can be replayed.
	const hitTick = useHitPreviewTick();
	const struckTick = useLagged(hitTick, PREVIEW_STRIKE_MS);
	const mendedTick = useLagged(hitTick, PREVIEW_MEND_MS);
	const previewBreak = struckTick === hitTick && mendedTick !== hitTick ? 1 : 0;
	const blueDamage = Math.min(MAX_HITS, blueLagged + previewBreak);
	const redStance = useLagged(state.red.stance, hud.hitLagMs);
	const blueStance = useLagged(state.blue.stance, hud.hitLagMs);

	// Both orientations: red top-left, blue top-right, flanking the round marker.
	const banner = (team: Team, damage: number, stance: typeof redStance) => (
		<PlayerBanner
			team={team}
			damage={damage}
			stance={stance}
			active={acting[team]}
			idleOpacity={hud.idleOpacity}
			caption={captionFor(state, team, local, viewerTeam)}
			align={team === "blue" ? "right" : "left"}
			scale={scale}
			compact={portrait}
		/>
	);

	return (
		<>
			<motion.div
				initial={{ opacity: 0, y: -12 }}
				animate={hudIn ? { opacity: 1, y: 0 } : { opacity: 0, y: -12 }}
				// Duel opening: lands once both samurai have stood up (state/duelIntro), never over the entrance.
				transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
				style={{
					position: "fixed",
					top: hud.inset,
					left: hud.inset,
					right: hud.inset,
					display: "grid",
					gridTemplateColumns: "1fr auto 1fr",
					alignItems: "start",
					pointerEvents: "none",
					userSelect: "none",
					zIndex: 1200,
				}}
			>
				<div style={{ justifySelf: "start" }}>{banner("red", redDamage, redStance)}</div>
				<RoundMarker round={state.round} caption={portrait ? null : PHASE_CAPTION[state.phase]} scale={scale} />
				<div style={{ justifySelf: "end" }}>{banner("blue", blueDamage, blueStance)}</div>
			</motion.div>
		</>
	);
};
