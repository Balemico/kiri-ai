import { useThree } from "@react-three/fiber";
import { LandingZone } from "../../atoms";
import { useGame } from "../../../state";
import { useSession } from "../../../net";
import type { Slot, Team } from "../../../game";
import {
	frameViewport,
	playedCardTransform,
	CARD_FACE_WIDTH,
	CARD_FACE_HEIGHT,
	DEFAULT_SCENE_FRAME,
	SLOT_KANJI,
	type Orientation,
	type PlayedMode,
	type SceneFrame, playedViewport
} from "../../../layout";
import { usePlayedCardControls } from "../../../hooks/usePlayedCardControls";
import { useLandingZoneControls } from "../../../hooks/useLandingZoneControls";
import { useBottomTeam } from "../../../hooks/useBottomTeam";

export interface LandingZonesProps {
	/** Same scene framing the played cards use, so the zones land exactly where the cards do. */
	frame?: SceneFrame;
	orientation?: Orientation;
}

/** A fixed column spot: which team's column, where in it, its numeral, and whether it's empty now. */
interface Spot {
	team: Team;
	slot: Slot;
	mode: PlayedMode;
	label?: string;
	/** The spot is currently empty — the guide shows (it cross-fades out once a card lands there). */
	active: boolean;
}

/**
 * Portrait-only landing-zone guides. Each team's side column has three fixed spots — the committed
 * pair (一 / 二) and the set-aside spot below them; while a spot is EMPTY a dashed, semi-transparent
 * card-shaped placeholder is drawn there (the committed spots carry the Japanese numeral, the
 * set-aside spot uses a different colour). Once a real card lands the spot fills and the guide is gone.
 * The placements reuse `playedCardTransform`, so the zones track the cards on any aspect.
 */
export const LandingZones = ({ frame = DEFAULT_SCENE_FRAME, orientation = "landscape" }: LandingZonesProps) => {
	const { state } = useGame();
	const { viewerTeam } = useSession();
	const played = usePlayedCardControls(orientation);
	const zone = useLandingZoneControls();
	const bottomTeam = useBottomTeam(viewerTeam);
	const size = useThree((s) => s.size);

	// Landing zones only make sense in the portrait side-columns (in landscape the cards rest in the
	// corners and lay flat by the line — no fixed column to reserve).
	if (orientation !== "portrait") return null;

	const viewport = frameViewport(frame, size.width / size.height);
	const vp = playedViewport(viewport, size.height);
	const pp = {
		bottomTeam,
		scaleFrac: played.playedScale,
		gap: played.playedGap,
		edge: played.playedEdge,
		setAsideScale: played.playedSetAside,
		setAsideOffset: played.playedSetAsideOffset,
		centerY: viewport.centerY + played.playedCenter,
	};

	// Every column spot for both teams is ALWAYS rendered; `active` (the spot is empty) drives a smooth
	// cross-fade so a card landing on — or leaving — its spot never makes the guide pop in/out.
	const spots: Spot[] = [];
	(["red", "blue"] as Team[]).forEach((team) => {
		(["first", "second"] as Slot[]).forEach((slot) => {
			spots.push({ team, slot, mode: "rest", label: SLOT_KANJI[slot], active: !state[team].placed[slot] });
		});
		spots.push({ team, slot: "second", mode: "setAside", active: !state[team].setAside });
	});

	return (
		<>
			{spots.map(({ team, slot, mode, label, active }) => {
				const t = playedCardTransform(team, slot, mode, vp, played, orientation, pp);
				const [x, y, z] = t.position;
				const scale = t.scale ?? 1;
				const w = Math.max(0, CARD_FACE_WIDTH * scale - 2 * zone.inset);
				const h = Math.max(0, CARD_FACE_HEIGHT * scale - 2 * zone.inset);
				const isSetAside = mode === "setAside";
				const color = isSetAside
					? team === "red"
						? zone.setAsideRed
						: zone.setAsideBlue
					: team === "red"
						? zone.usedRed
						: zone.usedBlue;
				return (
					<group key={`${team}-${mode}-${slot}`} position={[x, y, z]}>
						<LandingZone
							width={w}
							height={h}
							color={color}
							outlineOpacity={zone.outlineOpacity}
							fillOpacity={zone.fillOpacity}
							lineWidth={zone.lineWidth}
							dash={zone.dash}
							gap={zone.gap}
							cornerRadius={zone.cornerRadius}
							label={label}
							labelWorldSize={h * zone.numberScale}
							labelOpacity={zone.numberOpacity}
							active={active}
						/>
					</group>
				);
			})}
		</>
	);
};
