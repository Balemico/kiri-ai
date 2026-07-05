import { HudButton } from "../../atoms";
import { useGame, canConfirm, placedCount } from "../../../state";
import type { GameState, Team } from "../../../game";

const PHASE_TEXT: Record<GameState["phase"], string> = {
	place: "Place 2 cards, then confirm",
	ready: "Both ready — reveal the first action",
	"reveal-first": "First action resolved — reveal the second",
	"reveal-second": "Round resolved — start the next round",
	"round-end": "Starting next round…",
	"game-over": "Game over",
};

const TEAM_COLOR: Record<Team, string> = { red: "#dc2626", blue: "#2563eb" };

const MAX_LIFE = 2;

const PlayerStat = ({ label, team, state }: { label: string; team: Team; state: GameState }) => {
	const p = state[team];
	const life = MAX_LIFE - p.damage;
	return (
		<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
			<span style={{ minWidth: 34 }}>{label}</span>
			<span style={{ color: "#2ecc71", letterSpacing: 2 }}>
				{"♥".repeat(life)}
				<span style={{ color: "#5a2424" }}>{"♥".repeat(p.damage)}</span>
			</span>
			<span style={{ opacity: 0.7 }}>
				· space {p.space} · {p.stance}
			</span>
		</div>
	);
};

/** Phase-driven controls + status readout for the current turn. */
export const HudPanel = () => {
	const { state, dispatch } = useGame();
	const { phase, current, round, winner } = state;

	const renderAction = () => {
		switch (phase) {
			case "place":
				return (
					<HudButton
						color={TEAM_COLOR[current]}
						disabled={!canConfirm(state, current)}
						onClick={() => dispatch({ type: "CONFIRM_SELECTION" })}
					>
						Confirm {current} ({placedCount(state[current])}/2)
					</HudButton>
				);
			case "ready":
				return (
					<HudButton color="#16a34a" onClick={() => dispatch({ type: "REVEAL_FIRST" })}>
						Reveal First Cards
					</HudButton>
				);
			case "reveal-first":
				return (
					<HudButton color="#ca8a04" onClick={() => dispatch({ type: "REVEAL_SECOND" })}>
						Reveal Second Cards
					</HudButton>
				);
			case "reveal-second":
				return (
					<HudButton color="#7c3aed" onClick={() => dispatch({ type: "END_ROUND" })}>
						Start Next Round
					</HudButton>
				);
			case "game-over":
				return (
					<HudButton color="#0891b2" onClick={() => dispatch({ type: "RESET_GAME" })}>
						New Game
					</HudButton>
				);
			default:
				return null;
		}
	};

	return (
		<div>
			<div style={{ marginBottom: 16 }}>
				<h3 style={{ margin: "0 0 8px 0", fontSize: 18 }}>
					{winner ? `${winner.toUpperCase()} wins!` : `Round ${round}`}
				</h3>
				<p style={{ margin: 0, fontSize: 14, opacity: 0.8 }}>{PHASE_TEXT[phase]}</p>
			</div>
			<div style={{ marginBottom: 16 }}>{renderAction()}</div>
			<div style={{ fontSize: 12, opacity: 0.6, lineHeight: 1.6 }}>
				<PlayerStat label="Red" team="red" state={state} />
				<PlayerStat label="Blue" team="blue" state={state} />
			</div>
		</div>
	);
};
