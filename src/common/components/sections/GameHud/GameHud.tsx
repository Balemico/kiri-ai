import { motion } from "motion/react";
import { PlayerBanner, RoundMarker } from "../../molecules";
import { useGame } from "../../../state";
import { useSession } from "../../../net";
import { useLagged } from "../../../hooks/useLagged";
import { useIsPortrait } from "../../../hooks/useIsPortrait";
import { useGameHudControls } from "../../../hooks/useGameHudControls";
import type { GameState, Team, TurnPhase } from "../../../game";

const PHASE_CAPTION: Record<TurnPhase, string | null> = {
	place: "SCELTA DELLE CARTE",
	ready: "SI SCOPRONO LE CARTE",
	"reveal-first": "PRIMA AZIONE",
	"reveal-second": "SECONDA AZIONE",
	"round-end": "FINE ROUND",
	"game-over": "FINE DEL DUELLO",
};

/** Who is acting, from the viewer's seat. Pass & play: one player at a time; online: both at once. */
const isActing = (state: GameState, team: Team, local: boolean, viewerTeam: Team): boolean =>
	state.phase === "place" && !state.confirmed[team] && (!local || team === viewerTeam);

const captionFor = (state: GameState, team: Team, local: boolean, viewerTeam: Team): string | null => {
	if (state.phase === "game-over") return state.winner === team ? "VINCITORE" : null;
	if (state.phase !== "place") return null;
	if (state.confirmed[team]) return "PRONTO";
	if (team === viewerTeam) return "TOCCA A TE";
	return local ? null : "STA SCEGLIENDO";
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
	const scale = portrait ? hud.portraitScale : hud.scale;

	const redDamage = useLagged(state.red.damage, hud.hitLagMs);
	const blueDamage = useLagged(state.blue.damage, hud.hitLagMs);
	const redStance = useLagged(state.red.stance, hud.hitLagMs);
	const blueStance = useLagged(state.blue.stance, hud.hitLagMs);

	// Portrait: the top pawn always stands LEFT of the vertical line, so both banners stack in the
	// free top-right corner (right-aligned) instead of flanking the round marker.
	const banner = (team: Team, damage: number, stance: typeof redStance) => (
		<PlayerBanner
			team={team}
			damage={damage}
			stance={stance}
			active={isActing(state, team, local, viewerTeam)}
			caption={captionFor(state, team, local, viewerTeam)}
			align={portrait || team === "blue" ? "right" : "left"}
			scale={scale}
		/>
	);

	return (
		<motion.div
			initial={{ opacity: 0, y: -12 }}
			animate={{ opacity: 1, y: 0 }}
			// Lands once the fly-back reveal has settled, so the HUD doesn't fight the entrance.
			transition={{ duration: 0.8, delay: 1.6, ease: [0.22, 1, 0.36, 1] }}
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
			<div style={{ justifySelf: "start" }}>{!portrait && banner("red", redDamage, redStance)}</div>
			<RoundMarker round={state.round} caption={portrait ? null : PHASE_CAPTION[state.phase]} scale={scale} />
			<div style={{ justifySelf: "end", display: "flex", flexDirection: "column", gap: 12 * scale }}>
				{portrait && banner("red", redDamage, redStance)}
				{banner("blue", blueDamage, blueStance)}
			</div>
		</motion.div>
	);
};
