import { AnimatePresence, motion } from "motion/react";
import { LifeSeal, SealDisc, StanceDiamonds } from "../../atoms";
import { MAX_HITS, type Stance, type Team } from "../../../game";
import { INK, TEAM_INK, TEAM_KANJI } from "../../../hudPalette";
import { useT } from "../../../i18n";
import { GAME_HUD } from "../../../layout";

export interface PlayerBannerProps {
	team: Team;
	/** Hits taken (0…MAX_HITS) — each one cuts a life seal. */
	damage: number;
	stance: Stance;
	/** This player is the one acting now (placing cards) — the disc breathes, the name is underlined. */
	active: boolean;
	/** Opacity the whole banner fades to while this player is not acting (1 = no fade). */
	idleOpacity?: number;
	/** Short status under the name ("PRONTO", "STA SCEGLIENDO", …); null hides it. */
	caption?: string | null;
	/** Mirror the layout for the right-hand banner. */
	align: "left" | "right";
	scale?: number;
	/** Narrow (portrait) screens: no name — the 赤/青 disc and its colour already say who — and the
	 *  stance as its kanji only, on ONE row with the life seals. */
	compact?: boolean;
}

/**
 * A duellist's banner: the team kanji on a carved seal (赤 / 青), the name, the current stance
 * (天 heaven / 地 earth) and one hanko seal per life. No panel — ink straight on the paper sky,
 * like the lobby menu.
 */
export const PlayerBanner = ({ team, damage, stance, active, idleOpacity = 1, caption, align, scale = 1, compact = false }: PlayerBannerProps) => {
	const t = useT();
	const colour = TEAM_INK[team];
	const disc = 64 * scale;
	const right = align === "right";
	const row = right ? "row-reverse" : "row";

	// Brushed underline, painted in from the disc side while this player acts.
	const underline = (
		<motion.span
			initial={false}
			animate={{ scaleX: active ? 1 : 0, opacity: active ? 0.9 : 0 }}
			transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
			style={{
				position: "absolute",
				left: -2,
				right: -6,
				bottom: (compact ? -9 : -5) * scale,
				height: 4 * scale,
				borderRadius: "40% 60% 55% 45%",
				background: colour,
				transformOrigin: right ? "right" : "left",
			}}
		/>
	);

	// The stance as the cards print it: 天 / 地 on team-coloured diamonds, the one taken at full strength.
	const stanceMark = <StanceDiamonds stance={stance} colour={colour} size={(compact ? GAME_HUD.stanceDiamondCompact : GAME_HUD.stanceDiamond) * scale} />;

	// Lives are lost from the outside in, so the seal nearest the disc is the last one.
	const seals = Array.from({ length: MAX_HITS }, (_, i) => <LifeSeal key={i} broken={i >= MAX_HITS - damage} size={(compact ? GAME_HUD.lifeSealSizeCompact : GAME_HUD.lifeSealSize) * scale} tilt={i % 2 ? 3 : -4} />);

	return (
		// Not acting → the whole banner recedes a little, in step with its corner vignette resting in black.
		<motion.div
			initial={false}
			animate={{ opacity: active ? 1 : idleOpacity }}
			transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
			style={{ display: "flex", flexDirection: row, alignItems: "flex-start", gap: 14 * scale }}
		>
			{/* The avatar column: the team disc, the stance diamonds stacked under it as on the cards. */}
			<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: GAME_HUD.stanceGap * scale }}>
				<SealDisc kanji={TEAM_KANJI[team]} colour={colour} size={disc} active={active} />
				{stanceMark}
			</div>
			{/* Text column, centred on the disc (not on the taller avatar column). */}
			<div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: right ? "flex-end" : "flex-start", minHeight: disc, gap: 4 * scale, color: INK }}>
				{compact ? (
					// One row: the life seals, underlined while this player acts.
					<div style={{ position: "relative", display: "flex", flexDirection: row, alignItems: "center", gap: 5 * scale }}>
						{seals}
						{underline}
					</div>
				) : (
					<>
						<div style={{ position: "relative", fontWeight: 700, fontSize: 21 * scale, lineHeight: 1, letterSpacing: "0.16em" }}>
							{t(`team.${team}`)}
							{underline}
						</div>
						<div style={{ display: "flex", flexDirection: row, gap: 7 * scale, marginTop: 6 * scale }}>{seals}</div>
					</>
				)}
				{/* Fixed-height slot so the banner doesn't jump when the caption comes and goes. Compact hangs
				    it BELOW the row (out of flow), so the one row stays centred on the disc. */}
				<div
					style={
						compact
							? { position: "absolute", top: "100%", [right ? "right" : "left"]: 0, height: 20 * scale, marginTop: 12 * scale }
							: { height: 20 * scale, marginTop: 4 * scale }
					}
				>
					<AnimatePresence mode="wait">
						{caption && (
							<motion.span
								key={caption}
								initial={{ opacity: 0, x: right ? 8 : -8 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.3 }}
								style={{
									display: "inline-block",
									padding: `${2 * scale}px ${7 * scale}px`,
									border: `1px solid ${colour}`,
									borderRadius: 3,
									color: colour,
									fontSize: Math.max(9, 10 * scale),
									lineHeight: 1.3,
									letterSpacing: "0.2em",
									whiteSpace: "nowrap",
								}}
							>
								{caption}
							</motion.span>
						)}
					</AnimatePresence>
				</div>
			</div>
		</motion.div>
	);
};
