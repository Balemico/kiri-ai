import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { motion } from "motion/react";
import { InkStrokeLabel } from "../../atoms";
import type { InkTone } from "../../../ink/inkRegistry";
import { useGame } from "../../../state";
import { useSession } from "../../../net";
import { getCardLabel, isSpecial, type Slot, type Team } from "../../../game";
import {
	frameViewport,
	playedCardTransform,
	CARD_FACE_WIDTH,
	CARD_FACE_HEIGHT,
	DEFAULT_SCENE_FRAME,
	type Orientation,
	type PlayedMode,
	type SceneFrame, playedViewport,
	INK,
} from "../../../layout";
import { usePlayedCardControls } from "../../../hooks/usePlayedCardControls";
import { useCardNameControls } from "../../../hooks/useCardNameControls";
import { useBottomTeam } from "../../../hooks/useBottomTeam";

// The revealed card's name is painted on a sumi stroke in the player's colour (white lettering)…
const TEAM_TONE: Record<Team, InkTone> = { red: "red", blue: "blue" };
// …except special attacks, whose stroke is their own orange so they stand out.
const SPECIAL_TONE: InkTone = "orange";
// Horizontal padding of the portrait split stroke around the text (each side, in em). The landscape
// per-card stroke has none: it is exactly the card's width.
const STROKE_PAD_EM = 1.8;
// Vertical padding (each side, in em) — enough body that the lettering sits well inside the stroke.
const STROKE_PAD_Y_EM = 0.85;
// Hirokawa reserves a deep descender (ascent 0.79em, descent 0.39em) but its caps/kanji barely use
// it, so the glyphs' ink sits ~0.15em ABOVE the line box's centre — shift them down by that much so
// they read centred on the stroke (which is centred on the box).
const TEXT_DROP_EM = 0.15;
// The stroke only fills INK.strokeHeight of the label box, centred — the rest is bare paper below
// (and above) it. Pull the box up by that slack so the painted stroke, not the box, sits `gap`
// below the card's bottom edge.
const LINE_HEIGHT = 1.15;
// Portrait split row: share of the row's width the names are fitted into (see CardNameReveal).
const ROW_FIT = 0.8;
const STROKE_SLACK_EM = ((LINE_HEIGHT + STROKE_PAD_Y_EM * 2) * (1 - INK.strokeHeight)) / 2;

// The name reads kanji-first: the kanji carry the weight, the romaji follows smaller and spaced out
// (no " - " separator — the size step alone tells the two apart).
const KANJI_EM = 1.3;
const ROMAJI_EM = 0.7;
const ROMAJI_TRACK_EM = 0.1;
const ROMAJI_GAP_EM = 0.45;

/** Estimated line width of the name, in ems: CJK glyphs are ~full-width, latin ~half (+ its tracking). */
const labelWidthEm = (label: { ja: string; romaji: string }) =>
	Array.from(label.ja).length * 1.05 * KANJI_EM + ROMAJI_GAP_EM + label.romaji.length * (0.56 + ROMAJI_TRACK_EM) * ROMAJI_EM;

/** The name's lettering. The bigger kanji keep the container's line box (scaled line-height), so the
 *  stroke's height doesn't change with the size step. */
const nameText = (label: { ja: string; romaji: string }) => (
	<>
		<span style={{ fontSize: `${KANJI_EM}em`, lineHeight: LINE_HEIGHT / KANJI_EM }}>{label.ja}</span>
		<span style={{ fontSize: `${ROMAJI_EM}em`, letterSpacing: `${ROMAJI_TRACK_EM}em`, marginLeft: `${ROMAJI_GAP_EM / ROMAJI_EM}em`, opacity: 0.92 }}>{label.romaji}</span>
	</>
);

export interface CardNameRevealProps {
	/** Same scene framing the played cards use, so the label tracks the card on any aspect. */
	frame?: SceneFrame;
	orientation?: Orientation;
}

/** Where a played card sits this beat — mirrors Hand's slotMode so the label rides the real card. */
const slotMode = (phase: string, slot: Slot): PlayedMode => {
	switch (phase) {
		case "reveal-first":
			return slot === "first" ? "action" : "rest";
		case "reveal-second":
			return slot === "first" ? "toHand" : "action";
		default:
			return "rest";
	}
};

/**
 * As each card is revealed it rises into its team's corner; this floats the card's name —
 * `漢字 - romaji` — as its cartouche: a card-wide sumi stroke hung under it, white lettering on the player's colour (orange for specials), dropping in. Shows for the slot being
 * revealed this beat (first → reveal-first, second → reveal-second). At game-over the cards return to
 * hand, so the label steps aside and the WINS banner takes over.
 */
export const CardNameReveal = ({ frame = DEFAULT_SCENE_FRAME, orientation = "landscape" }: CardNameRevealProps) => {
	const { state } = useGame();
	const { viewerTeam } = useSession();
	const played = usePlayedCardControls(orientation);
	const name = useCardNameControls();
	const bottomTeam = useBottomTeam(viewerTeam);
	const size = useThree((s) => s.size);

	const slot: Slot | null =
		state.phase === "reveal-first" ? "first" : state.phase === "reveal-second" ? "second" : null;
	if (!slot) return null;

	const portrait = orientation === "portrait";
	const viewport = frameViewport(frame, size.width / size.height);
	const vp = playedViewport(viewport, size.height);
	// Portrait column placement, matching Hand, so the label rides the real card.
	const pp = portrait
		? { bottomTeam, scaleFrac: played.playedScale, gap: played.playedGap, edge: played.playedEdge, setAsideScale: played.playedSetAside, setAsideOffset: played.playedSetAsideOffset, centerY: viewport.centerY + played.playedCenter, tilt: played.playedTilt }
		: undefined;
	const mode = slotMode(state.phase, slot);
	// Convert a world width to on-screen pixels, to size the label so it never exceeds the card width.
	const toPx = (worldW: number) => (worldW / viewport.width) * size.width;

	// The name of each team's revealed card, with its stroke tone (orange for specials).
	const nameOf = (team: Team) => {
		const placed = state[team].placed[slot];
		const label = placed ? getCardLabel(placed.cardId, placed.side) : null;
		return placed && label ? { team, label, widthEm: labelWidthEm(label), tone: isSpecial(placed.cardId) ? SPECIAL_TONE : TEAM_TONE[team] } : null;
	};

	if (portrait) {
		// One row at the bottom, split down the middle: each half carries the card of the column on its
		// side (the turn player's on the left) in that card's tone — one stroke, two colours.
		const halves = [nameOf(bottomTeam), nameOf(bottomTeam === "red" ? "blue" : "red")];
		const shown = halves.filter((h) => h !== null);
		if (shown.length === 0) return null;
		const rowPx = size.width * name.portraitWidth;
		// Font: the longer name must fit its half (half the row, minus the stroke's outer padding).
		const halfEm = Math.max(...shown.map((h) => h.widthEm)) + STROKE_PAD_EM;
		// ROW_FIT: the em estimate runs short for the uppercase display face, and the frayed stroke ends
		// can't carry legible text — fit the names into a bit less than the full row.
		const fontPx = Math.max(name.minFontPx, Math.min((rowPx * ROW_FIT) / shown.length / halfEm, name.maxFontPx));
		const [left, right] = halves;
		const split = left && right ? { left: left.tone, right: right.tone } : undefined;
		return (
			<Html key={`row-${state.round}-${slot}`} position={[0, viewport.bottom + name.portraitBottom, 0]} style={{ pointerEvents: "none" }}>
				<div style={{ transform: "translate(-50%, -50%)" }}>
					<motion.div
						initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
						animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
						transition={{ duration: 0.5, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
						className="font-sans"
						style={{ whiteSpace: "nowrap", lineHeight: LINE_HEIGHT, fontSize: fontPx, fontWeight: 700, letterSpacing: "0.02em" }}
					>
						<InkStrokeLabel
							tone={shown[0].tone}
							split={split}
							variant={1}
							delay={0.2}
							style={{
								display: "grid",
								gridTemplateColumns: `repeat(${shown.length}, 1fr)`,
								// Air at the seam: each half keeps half a stroke-pad on either side of its name.
								columnGap: `${STROKE_PAD_EM}em`,
								width: rowPx,
								boxSizing: "border-box",
								padding: `${STROKE_PAD_Y_EM + TEXT_DROP_EM}em ${STROKE_PAD_EM / 2}em ${STROKE_PAD_Y_EM - TEXT_DROP_EM}em`,
							}}
						>
							{shown.map((h) => (
								<span key={h.team} style={{ textAlign: "center" }}>
									{nameText(h.label)}
								</span>
							))}
						</InkStrokeLabel>
					</motion.div>
				</div>
			</Html>
		);
	}

	return (
		<>
			{(["red", "blue"] as Team[]).map((team) => {
				const placed = state[team].placed[slot];
				if (!placed) return null;
				const label = getCardLabel(placed.cardId, placed.side);
				if (!label) return null;
				const tone = isSpecial(placed.cardId) ? SPECIAL_TONE : TEAM_TONE[team];
				const t = playedCardTransform(team, slot, mode, vp, played, orientation, pp);
				const [x, y, z] = t.position;
				// Landscape cards (action/rest) show their CARD_WIDTH edge vertically; upright ones (toHand,
				// and all portrait cards) show CARD_HEIGHT. Anchor just BELOW that bottom edge: the label is
				// the card's cartouche, and above it sits the still-covered card of the column.
				const landscape = Math.abs(Math.abs(t.rotationZ) - Math.PI / 2) < 0.5;
				const scale = t.scale ?? 1;
				const bottomEdge = ((landscape ? CARD_FACE_WIDTH : CARD_FACE_HEIGHT) / 2) * scale + name.gap;
				// The card's on-screen width: the stroke is exactly that wide, and the font is sized so the
				// whole label fits on ONE line inside it (`fontScale` of the width, the rest is the stroke's tips).
				const cardPx = toPx((landscape ? CARD_FACE_HEIGHT : CARD_FACE_WIDTH) * scale);
				const widthEm = labelWidthEm(label);
				const fontPx = Math.max(name.minFontPx, Math.min((cardPx * name.fontScale) / widthEm, name.maxFontPx));
				return (
					<Html
						// Keyed per reveal so the entrance animation replays each beat.
						key={`${team}-${state.round}-${slot}`}
						position={[x, y - bottomEdge, z]}
						style={{ pointerEvents: "none" }}
					>
						{/* Static wrapper top-centres the label under the card's bottom edge. The inner motion.div
						    owns its own transform for the drop-in, so the two never fight over `transform`. */}
						<div style={{ transform: "translate(-50%, 0)" }}>
							<motion.div
								initial={{ opacity: 0, y: -10, filter: "blur(6px)" }}
								animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
								transition={{ duration: 0.5, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
								className="font-sans"
								style={{
									// Font scaled (above) to the card width, kept on one line so it never spills past it.
									whiteSpace: "nowrap",
									textAlign: "center",
									lineHeight: LINE_HEIGHT,
									fontSize: fontPx,
									fontWeight: 700,
									letterSpacing: "0.02em",
								}}
							>
								<InkStrokeLabel
									tone={tone}
									variant={team === "red" ? 1 : 2}
									delay={0.2}
									// Exactly the card's width (border-box, no side padding): a band under the card, never overhanging it.
									style={{ boxSizing: "border-box", width: cardPx, padding: `${STROKE_PAD_Y_EM + TEXT_DROP_EM}em 0 ${STROKE_PAD_Y_EM - TEXT_DROP_EM}em`, marginTop: `-${STROKE_SLACK_EM}em` }}
								>
									{nameText(label)}
								</InkStrokeLabel>
							</motion.div>
						</div>
					</Html>
				);
			})}
		</>
	);
};
