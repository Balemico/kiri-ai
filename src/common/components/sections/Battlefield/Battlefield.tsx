import { useCallback, useState } from "react";
import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { motion } from "motion/react";
import { BoardLine, Pawn, ClashEffect, InkStrokeLabel, VictoryCamera } from "../../atoms";
import type { InkTone } from "../../../ink/inkRegistry";
import { useGame } from "../../../state";
import { useSession } from "../../../net";
import { spaceToX, type Stance, type Team } from "../../../game";
import { frameViewport, landscapeLineScale, lineCoord, BATTLEFIELD_HALF_WIDTH, portraitLateralSign, portraitLineBand, rakeLine, PAWN, pawnHeadHeight, DEFAULT_SCENE_FRAME, MARKER_REF_HEIGHT, type Orientation, type SceneFrame } from "../../../layout";
import { useBattlegroundControls } from "../../../hooks/useBattlegroundControls";
import { useBottomTeam } from "../../../hooks/useBottomTeam";
import { usePawnControls } from "../../../hooks/usePawnControls";
import { useSlashControls } from "../../../hooks/useSlashControls";
import { useClashControls } from "../../../hooks/useClashControls";
import { attackBeat, moveDelays, useResolutionControls } from "../../../hooks/useResolutionControls";
import { useGameHudControls } from "../../../hooks/useGameHudControls";
import { usePaperCutoutControls } from "../../../hooks/usePaperCutoutControls";
import { useDuelIntroDriver } from "../../../hooks/useDuelIntroDriver";
import { useVictoryRevealDriver } from "../../../hooks/useVictoryRevealDriver";
import { useWinBannerControls } from "../../../hooks/useWinBannerControls";
import { useDuelIntroReached } from "../../../state/duelIntro";
import { useVictoryCleared, useVictoryShown } from "../../../state/victoryReveal";
import { useHitPreviewTick } from "../../../state/hitPreview";
import { useT } from "../../../i18n";

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
	const t = useT();
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
	const win = useWinBannerControls();
	// Paper cut-out look + stand-up entrance; the Leva "play stand-up" bumps standTick to replay it.
	const [standTick, setStandTick] = useState(0);
	const replayStand = useCallback(() => setStandTick((t) => t + 1), []);
	// …and "play fall" bumps fallTick to preview the defeat fall on blue.
	const [fallTick, setFallTick] = useState(0);
	const replayFall = useCallback(() => setFallTick((t) => t + 1), []);
	const cutout = usePaperCutoutControls(replayStand, replayFall);
	// Leva "Game HUD → ▶ Play hit" also sways blue (the struck side of that preview).
	const hitTick = useHitPreviewTick();
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
	// The line fills the viewport height minus the hand reserve at the bottom (compensated for the
	// rake so its on-screen vertical span matches), so it grows/shrinks with the window.
	const size = useThree((s) => s.size);
	// Visible world height of the active frame — the basis for both the portrait line length and the
	// marker size, so the markers read at a consistent on-screen size in both orientations and scale
	// with the window (rather than a fixed world size 2.45× bigger in portrait).
	const { height: viewportHeight, width: viewportWidth } = frameViewport(frame, size.width / size.height);
	// Landscape: the line narrows on narrow windows so its end pawns clear the edge-hugging played cards.
	const lineScale = portrait ? 1 : landscapeLineScale(viewportWidth);
	// Portrait samurai are smaller (they flank the line between the card slots).
	const pawnHeight = portrait ? pawn.height * bg.pawnScale : pawn.height;
	// Portrait: the line lives in the band between the HUD (top, clearing the top samurai's head) and
	// the hand (bottom) — its length AND centre both derive from it.
	const band = portrait
		? portraitLineBand(frameViewport(frame, size.width / size.height), {
				handReserve: bg.handReserve,
				hudReserve: bg.hudReserve,
				margin: bg.margin,
				pawnHeight: pawnHeight * Math.max(PAWN.frames.heaven.scale, PAWN.frames.earth.scale),
				tilt: floorTilt,
			})
		: null;
	const pawnBaseY = band ? band.centerY + bg.lineNudge : bg.y;
	const lineLength = band ? band.length : BATTLEFIELD_HALF_WIDTH * 2 * lineScale;
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
	// Which cut-out paints over the other where they overlap: portrait = the nearer (bottom) one,
	// landscape = red. A struck figure drops behind while it sways (inside Pawn).
	const stackOf = (team: Team) => (team === (portrait ? bottomTeam : "red") ? PAWN.stack.front : PAWN.stack.back);

	// Staged resolution: while revealing, play the movement priority beats before the attack. The
	// higher-priority pawn slides first; the lower-priority one waits `moveStagger`; the strike lands
	// `attackGap` after movement settles. Equal priority (or a single mover) → no stagger.
	const resolution = state.lastResolution;
	const isReveal = state.phase === "reveal-first" || state.phase === "reveal-second";
	const delays = isReveal && resolution ? moveDelays(resolution, res) : { red: 0, blue: 0 };
	const redDelay = delays.red;
	const blueDelay = delays.blue;
	const attackDelay = isReveal && resolution ? attackBeat(resolution, res) : 0;
	// The defeated samurai falls back flat like paper (its stand-up in reverse), once the killing blow
	// has landed; the victory screen waits for the fall to finish (useVictoryRevealDriver).
	const fallDelay = (resolution ? attackBeat(resolution, res) : 0) + 0.8;
	const over = state.phase === "game-over" && state.winner !== null;
	const fallenOf = (team: Team) => over && state.winner !== team;
	useVictoryRevealDriver(over, fallDelay, fallDelay + cutout.standDur + win.afterFall);
	// Zanshin: as the loser starts to fall the callouts and team markers step aside (the HUD too), so
	// only the stage and the two figures remain; once the victory screen is in, the camera closes on the
	// winner (landscape — portrait has its own full-screen result).
	const cleared = useVictoryCleared();
	const victoryShown = useVictoryShown();

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
	const calloutFor = (team: Team): { text: string; tone: InkTone } | null => {
		if (!resolved || !resolution) return null;
		const o = resolution[team];
		if (o.countered) return { text: t("duel.counter"), tone: "orange" };
		if (o.wrongStance) return { text: t("duel.feint"), tone: "ink" };
		return null;
	};
	// A pawn's callout sits just over its head — the figure's measured top in its attack-time stance (a
	// crouched earth pose is shorter than heaven) + a small gap: landscape over the line, portrait above
	// each pawn at its own raked line position + lateral side.
	const calloutX = (team: Team) => (portrait ? lateralOf(team) : lineOf(team));
	const headOf = (team: Team) => pawn.yLift + pawnHeadHeight(attackStance(team), pawnHeight) + PAWN.calloutGap;
	const calloutYOf = (team: Team) => (portrait ? rakeLine(lineOf(team), portraitTilt, pawnBaseY).y + bg.pawnLift + headOf(team) : bg.y + headOf(team));
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
			<BoardLine y={pawnBaseY} length={lineLength} diamondTilt={portrait ? portraitTilt : bg.diamondTilt} redSpace={state.red.space} blueSpace={state.blue.space} current={activeTeam} redMoveDelay={redDelay} blueMoveDelay={blueDelay} moveDur={res.moveDur} orientation={orientation} bottomTeam={bottomTeam} markerScale={markerScale} spikeScale={portrait ? bg.spikeScale : 1} hideMarkers={cleared} />
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
						tone={callout.tone}
						delay={attackDelay}
						leaving={cleared}
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
				// Portrait: the root stands on the raked line (lineY); the figure's own base is the root.
				lineY={pawnBaseY}
				baseY={portrait ? 0 : pawnBaseY}
				height={pawnHeight}
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
				fallen={fallenOf("red")}
				stack={stackOf("red")}
				fallDelay={fallDelay}
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
				// Portrait: the root stands on the raked line (lineY); the figure's own base is the root.
				lineY={pawnBaseY}
				baseY={portrait ? 0 : pawnBaseY}
				height={pawnHeight}
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
				fallen={fallenOf("blue")}
				stack={stackOf("blue")}
				fallTick={fallTick}
				hitTick={hitTick}
				fallDelay={fallDelay}
				standDelay={cutout.revealDelay + cutout.stagger}
				standTick={standTick}
			/>
			{victoryShown && !portrait && state.winner && (
				<VictoryCamera frame={frame} focusX={bg.x + lineOf(state.winner)} duration={win.cameraDur} push={win.cameraPush} shift={win.cameraShift} lift={win.cameraLift} />
			)}
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
	/** Stroke tone: ink for a feint, orange for a counterattack. */
	tone: InkTone;
	/** Seconds to wait before it is slashed on (synced to the attack beat). */
	delay: number;
	/** The duel's closing beat: the callout fades away with the rest of the interface. */
	leaving?: boolean;
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/**
 * A combat title (Finta! / Contrattacco!) slashed on just over a pawn's head at the moment of the
 * strike: a short sumi stroke (drawn by the scene's `InkLayer`, like every ink label) with the word
 * in white, condensing out of a blur as the brush passes.
 */
const PawnCallout = ({ x, y, z, text, tone, delay, leaving = false }: PawnCalloutProps) => (
	// zIndexRange: above the duel's ink layer (1450) so the white word sits ON its stroke. It fades out
	// with the HUD on the closing beat, before any victory veil comes in.
	<Html position={[x, y, z]} zIndexRange={[1460, 1460]} style={{ pointerEvents: "none" }}>
		{/* Static wrapper bottom-centres the label over the pawn's head; motion owns the transforms. */}
		<div style={{ transform: "translate(-50%, -100%)" }}>
			<motion.div initial={false} animate={leaving ? { opacity: 0, y: -6 } : { opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE_OUT }}>
				<InkStrokeLabel tone={tone} variant={1} delay={delay} style={{ padding: "0.42em 1.1em 0.3em" }}>
					<motion.span
						initial={{ opacity: 0, scale: 1.15, filter: "blur(6px)" }}
						animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
						transition={{ duration: 0.35, delay: delay + 0.12, ease: EASE_OUT }}
						style={{
							display: "inline-block",
							fontFamily: "var(--font-display)",
							whiteSpace: "nowrap",
							// Scales with the window width, clamped for phones / capped on desktop.
							fontSize: "clamp(15px, 3.2vw, 28px)",
							lineHeight: 1,
							letterSpacing: "0.04em",
						}}
					>
						{text}
					</motion.span>
				</InkStrokeLabel>
			</motion.div>
		</div>
	</Html>
);
