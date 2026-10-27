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
// Horizontal padding of the stroke around the text (each side, in em). NOT part of the fitted width:
// the lettering keeps its card-wide size and the stroke may overhang the card a little.
const STROKE_PAD_EM = 1.8;
// Vertical padding (each side, in em) — enough body that the lettering sits well inside the stroke.
const STROKE_PAD_Y_EM = 0.85;
// Hirokawa reserves a deep descender (ascent 0.79em, descent 0.39em) but its caps/kanji barely use
// it, so the glyphs' ink sits ~0.15em ABOVE the line box's centre — shift them down by that much so
// they read centred on the stroke (which is centred on the box).
const TEXT_DROP_EM = 0.15;
// The stroke only fills INK.strokeHeight of the label box, centred — the rest is bare paper below
// (and above) it. Pull the box down by that slack so the painted stroke, not the box, sits `gap`
// above the card's top edge.
const LINE_HEIGHT = 1.15;
const STROKE_SLACK_EM = ((LINE_HEIGHT + STROKE_PAD_Y_EM * 2) * (1 - INK.strokeHeight)) / 2;

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
 * `漢字 - romaji` — just above it, white on a sumi stroke in the player's colour (orange for specials), fading/rising in. Shows for the slot being
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
		? { bottomTeam, scaleFrac: played.playedScale, gap: played.playedGap, edge: played.playedEdge, setAsideScale: played.playedSetAside, setAsideOffset: played.playedSetAsideOffset, centerY: viewport.centerY + played.playedCenter }
		: undefined;
	const mode = slotMode(state.phase, slot);
	// Convert a world width to on-screen pixels, to size the label so it never exceeds the card width.
	const toPx = (worldW: number) => (worldW / viewport.width) * size.width;

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
				// and all portrait cards) show CARD_HEIGHT. Anchor just above that top edge so the label hugs it.
				const landscape = Math.abs(Math.abs(t.rotationZ) - Math.PI / 2) < 0.5;
				const scale = t.scale ?? 1;
				const topEdge = ((landscape ? CARD_FACE_WIDTH : CARD_FACE_HEIGHT) / 2) * scale + name.gap;
				// The card's on-screen width → size the font so the whole label fits on ONE line inside it.
				// Estimate the line width in ems: CJK glyphs are ~full-width, latin (romaji + " - ") ~half.
				const cardPx = toPx((landscape ? CARD_FACE_HEIGHT : CARD_FACE_WIDTH) * scale);
				const widthEm = Array.from(label.ja).length * 1.05 + (label.romaji.length + 3) * 0.56;
				const fontPx = Math.max(name.minFontPx, Math.min((cardPx * name.fontScale) / widthEm, name.maxFontPx));
				return (
					<Html
						// Keyed per reveal so the entrance animation replays each beat.
						key={`${team}-${state.round}-${slot}`}
						position={[x, y + topEdge, z]}
						style={{ pointerEvents: "none" }}
					>
						{/* Static wrapper bottom-centres the label on the card's top edge. The inner motion.div
						    owns its own transform for the rise-in, so the two never fight over `transform`. */}
						<div style={{ transform: "translate(-50%, -100%)" }}>
							<motion.div
								initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
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
								<InkStrokeLabel tone={tone} variant={team === "red" ? 1 : 2} delay={0.2} style={{ padding: `${STROKE_PAD_Y_EM + TEXT_DROP_EM}em ${STROKE_PAD_EM}em ${STROKE_PAD_Y_EM - TEXT_DROP_EM}em`, marginBottom: `-${STROKE_SLACK_EM}em` }}>
									{label.ja} - {label.romaji}
								</InkStrokeLabel>
							</motion.div>
						</div>
					</Html>
				);
			})}
		</>
	);
};
