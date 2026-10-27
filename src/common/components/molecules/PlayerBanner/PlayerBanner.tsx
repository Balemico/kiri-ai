import { AnimatePresence, motion } from "motion/react";
import { LifeSeal, SealDisc } from "../../atoms";
import { MAX_HITS, type Stance, type Team } from "../../../game";
import { INK, STANCE_LABEL, TEAM_INK, TEAM_KANJI, TEAM_NAME } from "../../../hudPalette";

export interface PlayerBannerProps {
	team: Team;
	/** Hits taken (0…MAX_HITS) — each one cuts a life seal. */
	damage: number;
	stance: Stance;
	/** This player is the one acting now (placing cards) — the disc breathes, the name is underlined. */
	active: boolean;
	/** Short status under the name ("TOCCA A TE", "PRONTO", …); null hides it. */
	caption?: string | null;
	/** Mirror the layout for the right-hand banner. */
	align: "left" | "right";
	scale?: number;
}

/**
 * A duellist's banner: the team kanji on a carved seal (赤 / 青), the name, the current stance
 * (天 heaven / 地 earth) and one hanko seal per life. No panel — ink straight on the paper sky,
 * like the lobby menu.
 */
export const PlayerBanner = ({ team, damage, stance, active, caption, align, scale = 1 }: PlayerBannerProps) => {
	const colour = TEAM_INK[team];
	const disc = 64 * scale;
	const right = align === "right";
	const stanceLabel = STANCE_LABEL[stance];
	return (
		<div style={{ display: "flex", flexDirection: right ? "row-reverse" : "row", alignItems: "center", gap: 14 * scale }}>
			<SealDisc kanji={TEAM_KANJI[team]} colour={colour} size={disc} active={active} />
			<div style={{ display: "flex", flexDirection: "column", alignItems: right ? "flex-end" : "flex-start", gap: 4 * scale, color: INK }}>
				<div style={{ position: "relative", fontWeight: 700, fontSize: 21 * scale, lineHeight: 1, letterSpacing: "0.16em" }}>
					{TEAM_NAME[team]}
					{/* Brushed underline, painted in from the disc side while this player acts. */}
					<motion.span
						initial={false}
						animate={{ scaleX: active ? 1 : 0, opacity: active ? 0.9 : 0 }}
						transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
						style={{
							position: "absolute",
							left: -2,
							right: -6,
							bottom: -5 * scale,
							height: 4 * scale,
							borderRadius: "40% 60% 55% 45%",
							background: colour,
							transformOrigin: right ? "right" : "left",
						}}
					/>
				</div>
				<div
					style={{ display: "flex", flexDirection: right ? "row-reverse" : "row", alignItems: "baseline", gap: 6 * scale, fontSize: 12 * scale, letterSpacing: "0.18em", opacity: 0.72, marginTop: 4 * scale }}
				>
					<AnimatePresence mode="popLayout" initial={false}>
						<motion.span
							key={stance}
							initial={{ opacity: 0, y: -6 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: 6 }}
							transition={{ duration: 0.3 }}
							style={{ fontFamily: "var(--font-display)", fontSize: 17 * scale, letterSpacing: 0 }}
						>
							{stanceLabel.kanji}
						</motion.span>
					</AnimatePresence>
					<span>{stanceLabel.label}</span>
				</div>
				<div style={{ display: "flex", flexDirection: right ? "row-reverse" : "row", gap: 7 * scale, marginTop: 2 * scale }}>
					{Array.from({ length: MAX_HITS }, (_, i) => (
						// Lives are lost from the outside in, so the seal nearest the disc is the last one.
						<LifeSeal key={i} broken={i >= MAX_HITS - damage} size={24 * scale} tilt={i % 2 ? 3 : -4} />
					))}
				</div>
				{/* Fixed-height slot so the banner doesn't jump when the caption comes and goes. */}
				<div style={{ height: 20 * scale, marginTop: 4 * scale }}>
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
									fontSize: 10 * scale,
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
		</div>
	);
};
