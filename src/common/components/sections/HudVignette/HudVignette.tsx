import { useThree } from "@react-three/fiber";
import { CornerVignette, ScreenVignette } from "../../atoms";
import { useActingTeams } from "../../../hooks/useActingTeams";
import { useDuelIntroReached } from "../../../state/duelIntro";
import { useGameHudControls } from "../../../hooks/useGameHudControls";
import { useSession } from "../../../net";
import type { Team } from "../../../game";

interface Corner {
	corner: "left" | "right";
	team: Team;
	lit: boolean;
}

/**
 * Gradual corner vignette behind the HUD banners, inside the 3D scene (over the backdrop, under the cards). A corner
 * glows in its team's colour while that player is acting, otherwise rests in black. Red left, blue
 * right — in both orientations, like the banners.
 */
export const HudVignette = () => {
	const hud = useGameHudControls();
	// Held through a pass & play hand-over: the highlight moves only once the veil is tapped away.
	const actingTeams = useActingTeams();
	const acting = (team: Team) => actingTeams[team];
	// Online both players own a corner for the whole duel: an idle corner keeps its team colour, just
	// fainter (like its dimmed banner), instead of resting in black.
	const online = useSession().mode === "online";
	// Portrait (same test as Scene): smaller corners that stay behind the compact banners.
	const size = useThree((s) => s.size);
	const portrait = size.height >= size.width;

	// Duel opening: the vignette is part of the HUD — it fades in with it, not before.
	const hudIn = useDuelIntroReached("hud");

	const tone: Record<Team, string> = { red: hud.vignetteRed, blue: hud.vignetteBlue };
	const corners: Corner[] = [
		{ corner: "left", team: "red", lit: acting("red") },
		{ corner: "right", team: "blue", lit: acting("blue") },
	];

	if (!hudIn) return null;
	return (
		<>
			{corners.map(({ corner, team, lit }) => (
				<CornerVignette
					key={corner}
					corner={corner}
					shade={online ? tone[team] : hud.vignetteShade}
					shadeOpacity={online ? hud.vignetteIdleGlowOpacity : hud.vignetteShadeOpacity}
					glow={tone[team]}
					lit={lit}
					glowOpacity={hud.vignetteGlowOpacity}
					width={portrait ? hud.vignetteWidthPortrait : hud.vignetteWidth}
					height={portrait ? hud.vignetteHeightPortrait : hud.vignetteHeight}
					drift={hud.vignetteDrift}
					delay={0}
				/>
			))}
			{/* Dark edges + all four corners, over the glows: shades the acting team's colour down too. */}
			<ScreenVignette shade={hud.vignetteShade} opacity={portrait ? hud.edgeVignetteOpacityPortrait : hud.edgeVignetteOpacity} />
		</>
	);
};
