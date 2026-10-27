import { useCallback, useState } from "react";
import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { motion } from "motion/react";
import { BoardLine, Pawn, ClashEffect } from "../../atoms";
import { useGame } from "../../../state";
import { useSession } from "../../../net";
import { spaceToX, type Stance, type Team } from "../../../game";
import { frameViewport, landscapeLineScale, lineCoord, BATTLEFIELD_HALF_WIDTH, portraitLateralSign, portraitLineLength, rakeLine, DEFAULT_SCENE_FRAME, MARKER_REF_HEIGHT, type Orientation, type SceneFrame } from "../../../layout";
import { useBattlegroundControls } from "../../../hooks/useBattlegroundControls";
import { useBottomTeam } from "../../../hooks/useBottomTeam";
import { usePawnControls } from "../../../hooks/usePawnControls";
import { useSlashControls } from "../../../hooks/useSlashControls";
import { useClashControls } from "../../../hooks/useClashControls";
import { attackBeat, moveDelays, useResolutionControls } from "../../../hooks/useResolutionControls";
import { useGameHudControls } from "../../../hooks/useGameHudControls";
import { usePaperCutoutControls } from "../../../hooks/usePaperCutoutControls";
import { useDuelIntroDriver } from "../../../hooks/useDuelIntroDriver";
import { useDuelIntroReached } from "../../../state/duelIntro";

/** The battlefield line with both samurai pawns, positioned by the "Battleground" controls. */
export const Battlefield = ({
	orientation = "landscape",
	frame = DEFAULT_SCENE_FRAME,
	floorTilt = 0,
	standUp = true,
}: {
	orientation?: Orientation;
	frame?: SceneFrame;
	floorTilt?: number;
	/** False = the paper samurai lie flat on the floor; flipping true springs them up (game start). */
	standUp?: boolean;
}) => {
	const { state } = useGame();
	const { viewerTeam } = useSession();
	const bg = useBattlegroundControls(orientation);
	const pawn = usePawnControls();
	// A monotonically increasing tick the Leva "Play" button bumps to preview the slash on both pawns.
	const [slashTick, setSlashTick] = useState(0);
	const playSlash = useCallback(() => setSlashTick((t) => t + 1), []);
	const slash = useSlashControls(playSlash);
	// A monotonically increasing tick the Leva "Play clash" button bumps to preview the parry X.
	const [clashTick, setClashTick] = useState(0);
	const playClash = useCallback(() => setClashTick((t) => t + 1), []);
	const clash = useClashControls(playClash);
	const res = useResolutionControls();
	const hud = useGameHudControls();
	// Paper cut-out look + stand-up entrance; the Leva "play stand-up" bumps standTick to replay it.
	const [standTick, setStandTick] = useState(0);
	const replayStand = useCallback(() => setStandTick((t) => t + 1), []);
	const cutout = usePaperCutoutControls(replayStand);
	// Duel opening: the HUD, then the first turn, follow once the second samurai is fully up.
	useDuelIntroDriver(standUp, cutout.revealDelay + cutout.stagger + cutout.standDur, hud.introHudDelay, hud.introTurnDelay);
	const turnOpen = useDuelIntroReached("turn");
	// The active (pulsing) marker shows only while placing — highlighting the viewer's own pawn (the
	// colour this device plays). Once both are ready, through the reveal and round end, no marker pulses.
	// Not before the first turn has begun (duel opening).
	const isPlacing = state.phase === "place" && turnOpen;
	const activeTeam = isPlacing ? viewerTeam : null;

	// Portrait: the line turns vertical. The turn player sits at the BOTTOM (its character + marker to
	// the right of the line), the opponent at the top (to the left). While placing, the bottom team is
	// the active placer; during the reveal/round-end (no placer) the view is neutral — red at bottom.
	const portrait = orientation === "portrait";
	// bottomTeam changes are delayed by the cover duration, so on CONFIRM the cards flip face-down in
	// place first and the view inverts only afterwards.
	const bottomTeam = useBottomTeam(viewerTeam);
	const axis = portrait ? "y" : "x";
	const pawnBaseY = portrait ? bg.baseY : bg.y;
	// The line fills the viewport height minus the hand reserve at the bottom (compensated for the
	// rake so its on-screen vertical span matches), so it grows/shrinks with the window.
	const size = useThree((s) => s.size);
	// Visible world height of the active frame — the basis for both the portrait line length and the
	// marker size, so the markers read at a consistent on-screen size in both orientations and scale
	// with the window (rather than a fixed world size 2.45× bigger in portrait).
	const { height: viewportHeight, width: viewportWidth } = frameViewport(frame, size.width / size.height);
	// Landscape: the line narrows on narrow windows so its end pawns clear the edge-hugging played cards.
	const lineScale = portrait ? 1 : landscapeLineScale(viewportWidth);
	const lineLength = portrait ? portraitLineLength(viewportHeight, bg.handReserve, bg.margin, floorTilt) : BATTLEFIELD_HALF_WIDTH * 2 * lineScale;
	const markerScale = (viewportHeight / MARKER_REF_HEIGHT) * bg.thickness;
	// Each pawn's coordinate ALONG the line (world-x landscape, world-y portrait).
	const redLine = portrait ? lineCoord(state.red.space, bottomTeam, lineLength) : spaceToX(state.red.space) * lineScale;
	const blueLine = portrait ? lineCoord(state.blue.space, bottomTeam, lineLength) : spaceToX(state.blue.space) * lineScale;
	// Viewport-INDEPENDENT logical coordinate (line at unit length): unchanged by a resize, so the pawns
	// snap (not tween) to a rescaled line and stay locked to it (see Pawn `moveKey`).
	const redMoveKey = portrait ? lineCoord(state.red.space, bottomTeam) : spaceToX(state.red.space);
	const blueMoveKey = portrait ? lineCoord(state.blue.space, bottomTeam) : spaceToX(state.blue.space);
	const shared = Math.abs(redLine - blueLine) < 0.01;
	// Landscape nudges the two pawns apart along the line when they share a space; portrait already
	// keeps them on opposite lateral sides, so no nudge is needed there.
	const redLinePos = portrait || !shared ? redLine : redLine - bg.sharedOffset;
	const blueLinePos = portrait || !shared ? blueLine : blueLine + bg.sharedOffset;
	// Portrait lateral offset (x): the bottom team's pawn/marker sit right of the line, the top left.
	const redLateral = portrait ? portraitLateralSign("red", bottomTeam) * bg.laneOffset : 0;
	const blueLateral = portrait ? portraitLateralSign("blue", bottomTeam) * bg.laneOffset : 0;
	const lineOf = (team: Team) => (team === "red" ? redLinePos : blueLinePos);
	const lateralOf = (team: Team) => (team === "red" ? redLateral : blueLateral);

	// Staged resolution: while revealing, play the movement priority beats before the attack. The
	// higher-priority pawn slides first; the lower-priority one waits `moveStagger`; the strike lands
	// `attackGap` after movement settles. Equal priority (or a single mover) → no stagger.
	const resolution = state.lastResolution;
	const isReveal = state.phase === "reveal-first" || state.phase === "reveal-second";
	const delays = isReveal && resolution ? moveDelays(resolution, res) : { red: 0, blue: 0 };
	const redDelay = delays.red;
	const blueDelay = delays.blue;
	const attackDelay = isReveal && resolution ? attackBeat(resolution, res) : 0;

	// On a parry the X crosses at the midpoint between the pawns, struck at the attack beat. The Leva
	// "Play clash" button previews it (clashTick) regardless of phase, played immediately.
	// Portrait rake: the duel line lies on the SAME plane as the floor (its live tilt, shared from
	// Scene), so the pawns, markers, callouts and clash all sit on that receding plane via `rakeLine`.
	const portraitTilt = floorTilt;

	const clashing = isReveal && !!resolution?.clash;
	const showClash = clashing || clashTick > 0;
	// The parry X crosses between the two pawns: midpoint along the line (landscape x, portrait y);
	// portrait pawns sit on opposite lateral sides so their meeting point is on the raked line (x = 0).
	const clashMid = rakeLine((redLinePos + blueLinePos) / 2, portraitTilt, pawnBaseY);
	const clashPos: [number, number, number] = portrait
		? [0, clashMid.y + pawn.height * 0.45, clashMid.z + pawn.z + 0.1]
		: [(redLine + blueLine) / 2, bg.y + pawn.height * 0.45, pawn.z + 0.1];

	// Per-pawn combat callout, shown at the attack beat: a successful Counterattack reads
	// "Contrattacco!" (orange); attacking from a stance the card doesn't allow reads "Finta!" (black).
	// (An in-stance attack that only misses on range is not flagged.) Stays through game-over (a winning
	// counter skips straight past the reveal phase).
	const resolved = isReveal || state.phase === "game-over";
	const calloutFor = (team: Team): { text: string; color: string } | null => {
		if (!resolved || !resolution) return null;
		const o = resolution[team];
		if (o.countered) return { text: "Contrattacco!", color: "#e6812c" };
		if (o.wrongStance) return { text: "Finta!", color: "#111111" };
		return null;
	};
	// A pawn's callout floats above its head: landscape at a fixed height over the line, portrait above
	// each pawn at its own raked line position + lateral side.
	const calloutX = (team: Team) => (portrait ? lateralOf(team) : lineOf(team));
	const calloutYOf = (team: Team) => (portrait ? rakeLine(lineOf(team), portraitTilt, pawnBaseY).y + bg.pawnLift + pawn.height + 0.2 : bg.y + pawn.height + 0.2);
	const calloutZOf = (team: Team) => (portrait ? rakeLine(lineOf(team), portraitTilt, pawnBaseY).z + pawn.z : pawn.z);

	// Kesa/Zan-Tetsu attack in their stance and only flip afterwards. So during the strike the pawn must
	// still read in its PRE-switch pose, and the cut on the opponent must point from that pose. Use the
	// attack-time stance for the slash direction, and hold the visual flip until after the strike lands.
	const flip = (s: Stance): Stance => (s === "heaven" ? "earth" : "heaven");
	const switched = (team: Team): boolean => isReveal && !!resolution?.[team].switchedStance;
	const attackStance = (team: Team): Stance => (switched(team) ? flip(state[team].stance) : state[team].stance);
	const stanceDelay = (team: Team): number => (switched(team) ? attackDelay + 0.4 : 0);

	return (
		<group position={[bg.x, 0, 0]}>
			<BoardLine y={pawnBaseY} length={lineLength} diamondTilt={portrait ? portraitTilt : bg.diamondTilt} redSpace={state.red.space} blueSpace={state.blue.space} current={activeTeam} redMoveDelay={redDelay} blueMoveDelay={blueDelay} moveDur={res.moveDur} orientation={orientation} bottomTeam={bottomTeam} markerScale={markerScale} />
			{(["red", "blue"] as Team[]).map((team) => {
				const callout = calloutFor(team);
				if (!callout) return null;
				return (
					<PawnCallout
						key={`${state.round}-${resolution!.slot}-${team}`}
						x={calloutX(team)}
						y={calloutYOf(team)}
						z={calloutZOf(team)}
						text={callout.text}
						color={callout.color}
						delay={attackDelay}
					/>
				);
			})}
			<Pawn
				linePos={redLinePos}
				moveKey={redMoveKey}
				axis={axis}
				tilt={portraitTilt}
				lift={bg.pawnLift}
				lateral={redLateral}
				team="red"
				stance={state.red.stance}
				damage={state.red.damage}
				baseY={pawnBaseY}
				height={pawn.height}
				yLift={pawn.yLift}
				z={pawn.z}
				slash={slash}
				slashTick={slashTick}
				attackerStance={attackStance("blue")}
				moveDelay={redDelay}
				moveDur={res.moveDur}
				attackDelay={attackDelay}
				stanceDelay={stanceDelay("red")}
				cutout={cutout}
				standing={standUp}
				standDelay={cutout.revealDelay}
				standTick={standTick}
			/>
			<Pawn
				linePos={blueLinePos}
				moveKey={blueMoveKey}
				axis={axis}
				tilt={portraitTilt}
				lift={bg.pawnLift}
				lateral={blueLateral}
				team="blue"
				stance={state.blue.stance}
				damage={state.blue.damage}
				baseY={pawnBaseY}
				height={pawn.height}
				yLift={pawn.yLift}
				z={pawn.z}
				slash={slash}
				slashTick={slashTick}
				attackerStance={attackStance("red")}
				moveDelay={blueDelay}
				moveDur={res.moveDur}
				attackDelay={attackDelay}
				stanceDelay={stanceDelay("blue")}
				cutout={cutout}
				standing={standUp}
				standDelay={cutout.revealDelay + cutout.stagger}
				standTick={standTick}
			/>
			{showClash && (
				<ClashEffect
					key={`${clashing ? `${state.round}-${resolution!.slot}` : "preview"}-${clashTick}`}
					x={clashPos[0]}
					y={clashPos[1]}
					z={clashPos[2]}
					height={pawn.height}
					delay={clashing ? attackDelay : 0}
					look={slash}
					place={clash}
				/>
			)}
		</group>
	);
};

interface PawnCalloutProps {
	x: number;
	y: number;
	z: number;
	text: string;
	color: string;
	/** Seconds to wait before popping in (synced to the attack beat). */
	delay: number;
}

/** A combat title (Finta! / Contrattacco!) that pops in above a pawn at the moment of the strike. */
const PawnCallout = ({ x, y, z, text, color, delay }: PawnCalloutProps) => (
	<Html position={[x, y, z]} style={{ pointerEvents: "none" }}>
		{/* Static wrapper bottom-centres the title over the pawn's head; motion owns the pop-in transform. */}
		<div style={{ transform: "translate(-50%, -100%)" }}>
			<motion.div
				initial={{ opacity: 0, y: 10, scale: 0.8 }}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
				className="font-sans"
				style={{
					color,
					whiteSpace: "nowrap",
					fontWeight: 800,
					// Scales with the window width, clamped for phones / capped on desktop.
					fontSize: "clamp(16px, 4.5vw, 32px)",
					letterSpacing: "0.03em",
					// Light halo + dark drop so it reads on both pale paper and dark ink.
					textShadow: "0 0 5px rgba(255,255,255,0.9), 0 2px 10px rgba(0,0,0,0.55)",
				}}
			>
				{text}
			</motion.div>
		</div>
	</Html>
);

