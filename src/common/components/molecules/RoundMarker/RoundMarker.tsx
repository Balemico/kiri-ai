import { useId } from "react";
import { AnimatePresence, motion } from "motion/react";
import { INK, kanjiNumeral } from "../../../hudPalette";
import { useT } from "../../../i18n";
import { ENSO, ENSO_HEAD } from "../../../enso";

export interface RoundMarkerProps {
	round: number;
	scale?: number;
	/** Makes the ensō the in-duel menu button (a small "MENU" hint under it); absent = inert. */
	onMenu?: () => void;
}

/**
 * The round number as a kanji numeral (一, 二, 三…) inside an ensō — the open zen brush circle, a real
 * brush gesture (heavy head, thinning arc, dry broken tail — geometry in `enso.ts`).
 * Each new round re-draws the circle and stamps the numeral in, so the round change is felt.
 */
export const RoundMarker = ({ round, scale = 1, onMenu }: RoundMarkerProps) => {
	const t = useT();
	const filterId = useId().replace(/:/g, "");
	const size = 76 * scale;
	// The ensō + its MENU hint form one tap target (the HUD itself lets pointers through).
	const menuTarget = onMenu
		? {
				role: "button",
				tabIndex: 0,
				"aria-label": "Menu",
				onClick: onMenu,
				onKeyDown: (e: React.KeyboardEvent) => {
					if (e.key === "Enter" || e.key === " ") onMenu();
				},
			}
		: {};
	return (
		<div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: INK }}>
			<motion.div
				{...menuTarget}
				whileHover={onMenu ? { scale: 1.05 } : undefined}
				whileTap={onMenu ? { scale: 0.94 } : undefined}
				style={{ position: "relative", width: size, height: size, cursor: onMenu ? "pointer" : undefined, pointerEvents: onMenu ? "auto" : "none", outline: "none", WebkitTapHighlightColor: "transparent" }}
			>
				<svg viewBox="0 0 100 100" width={size} height={size} style={{ position: "absolute", inset: 0, overflow: "visible" }} aria-hidden>
					<defs>
						{/* Fine paper-tooth roughness on the brush edges. */}
						<filter id={`${filterId}-edge`} x="-20%" y="-20%" width="140%" height="140%">
							<feTurbulence type="fractalNoise" baseFrequency="0.35" numOctaves="2" seed="7" />
							<feDisplacementMap in="SourceGraphic" scale="1.6" />
						</filter>
						<filter id={`${filterId}-bleed`} x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="1.4" />
						</filter>
						{/* Keyed by round: a fresh ensō is brushed on every round — the mask runs along the
						    gesture's spine, uncovering the brush mark in the order it was painted. */}
						<mask id={`${filterId}-draw`} maskUnits="userSpaceOnUse" x="-10" y="-10" width="120" height="120">
							<motion.path
								key={round}
								d={ENSO.spine}
								fill="none"
								stroke="#fff"
								strokeWidth={30}
								initial={{ pathLength: 0 }}
								animate={{ pathLength: 1 }}
								transition={{ duration: 0.9, ease: [0.45, 0, 0.2, 1] }}
							/>
						</mask>
					</defs>
					<g mask={`url(#${filterId}-draw)`} fill={INK}>
						<path d={ENSO.wash} opacity={0.13} filter={`url(#${filterId}-bleed)`} />
						<g filter={`url(#${filterId}-edge)`} opacity={0.9}>
							<path d={ENSO.body} />
							<circle cx={ENSO_HEAD.cx} cy={ENSO_HEAD.cy} r={ENSO_HEAD.r} />
							{ENSO.strands.map((s, i) => (
								<path key={i} d={s.d} fill="none" stroke={INK} strokeWidth={s.width} strokeLinecap="round" />
							))}
						</g>
					</g>
				</svg>
				<AnimatePresence mode="popLayout" initial={false}>
					<motion.span
						key={round}
						initial={{ opacity: 0, scale: 1.5 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.8 }}
						transition={{ duration: 0.45, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
						style={{
							position: "absolute",
							inset: 0,
							display: "grid",
							placeItems: "center",
							fontFamily: "var(--font-display)",
							fontSize: size * (round >= 10 ? 0.3 : 0.38),
							lineHeight: 1,
						}}
					>
						{kanjiNumeral(round)}
					</motion.span>
				</AnimatePresence>
			</motion.div>
			{/* The hint that the ensō opens the menu (never below 9px, or it turns into a smudge). */}
			{onMenu && (
				<span
					onClick={onMenu}
					style={{
						marginTop: 4 * scale,
						paddingLeft: "0.28em",
						fontSize: Math.max(9, 9 * scale),
						fontWeight: 600,
						letterSpacing: "0.28em",
						lineHeight: 1,
						opacity: 0.55,
						whiteSpace: "nowrap",
						cursor: "pointer",
						pointerEvents: "auto",
					}}
				>
					{t("hud.menu")}
				</span>
			)}
		</div>
	);
};
