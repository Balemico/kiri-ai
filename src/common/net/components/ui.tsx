import { LayoutGroup, motion } from "motion/react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { LOBBY } from "../../layout";
import { InkSegmentedStroke, InkStrokeButton, type InkSegmentOption } from "../../components/atoms";
import { soundPref, useSoundOn } from "../../state/soundPref";
import { langPref, useLang, type Lang } from "../../state/langPref";
import { useT } from "../../i18n";
import { playSound } from "../../audio";

/** Single-line text field styled for the dark paper card. */
export const TextField = ({
	value,
	onChange,
	placeholder,
	onEnter,
}: {
	value: string;
	onChange: (v: string) => void;
	placeholder?: string;
	onEnter?: () => void;
}) => (
	<input
		type="text"
		value={value}
		placeholder={placeholder}
		// Room keywords are case-sensitive at the transport level; stop mobile keyboards from
		// silently capitalizing or "correcting" them (the display font hides the difference).
		autoCapitalize="none"
		autoCorrect="off"
		spellCheck={false}
		onChange={(e) => onChange(e.target.value)}
		onKeyDown={(e) => {
			if (e.key === "Enter") onEnter?.();
		}}
		style={{
			width: "100%",
			padding: "12px 16px",
			fontSize: 16,
			letterSpacing: 1,
			color: "#17120e",
			background: "rgba(244, 238, 224, 0.85)",
			border: "1px solid rgba(23, 18, 14, 0.35)",
			borderRadius: 4,
			outline: "none",
			boxShadow: "inset 0 1px 4px rgba(0, 0, 0, 0.12)",
		}}
	/>
);

/** True when the WINDOW is portrait — DOM-side twin of the canvas-size check the scenes use. */
// eslint-disable-next-line react-refresh/only-export-components
export const usePortraitWindow = (): boolean => {
	const [portrait, setPortrait] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(orientation: portrait)").matches);
	useEffect(() => {
		const mq = window.matchMedia("(orientation: portrait)");
		const onChange = () => setPortrait(mq.matches);
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, []);
	return portrait;
};

/** Vermilion seal stamp — the waiting room's keyword reads as a hanko pressed on the paper. */
export const HankoStamp = ({ children }: { children: ReactNode }) => (
	<motion.div
		initial={{ opacity: 0, scale: 1.4, rotate: -2.5 }}
		animate={{ opacity: 1, scale: 1, rotate: -2.5 }}
		transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
		style={{
			alignSelf: "center",
			padding: "18px 26px",
			background: "#b73225",
			color: "#f5ede0",
			fontFamily: "var(--font-display)",
			fontSize: 26,
			letterSpacing: 4,
			borderRadius: 10,
			boxShadow: "0 6px 18px rgba(0, 0, 0, 0.3), inset 0 0 12px rgba(0, 0, 0, 0.22)",
			textTransform: "uppercase",
		}}
	>
		{children}
	</motion.div>
);

/**
 * The menu's home: a FIXED right column in landscape (the panorama flows behind it — no panel),
 * a centred stack in portrait. Pointer events re-enabled here (the backdrop layer disables them).
 */
export const LobbyColumn = ({ children, centered = false }: { children: ReactNode; centered?: boolean }) => {
	const portrait = usePortraitWindow();
	const center = portrait || centered;
	return (
		// `centered` = the entry gate. The switch to the menu column happens while the logo is dissolved
		// (Lobby's ENTRA exit), so the column simply moves — nothing visible travels with it. Centring
		// uses left/right + auto margins, so no transform competes with the children's layout glides.
		<div
			style={{
				position: "absolute",
				top: 0,
				bottom: 0,
				left: center ? 0 : "auto",
				right: center ? 0 : "4%",
				marginInline: center ? "auto" : 0,
				width: portrait ? "min(420px, 88vw)" : `${LOBBY.columnWidthPct}%`,
				maxWidth: 460,
				display: "flex",
				flexDirection: "column",
				justifyContent: "center",
				// Portrait: the logo is pushed to the top (Lobby's auto margins), the screen centred below it.
				paddingBlock: portrait ? "max(5vh, env(safe-area-inset-top, 0px)) 5vh" : undefined,
				gap: 26,
				pointerEvents: "auto",
			}}
		>
			{/* One layout group for the whole column: when any screen/view inside changes height, the
			    re-centred column's elements (logo included) glide to their new place together. */}
			<LayoutGroup>{children}</LayoutGroup>
		</div>
	);
};

/**
 * Brush-drawn speaker: the cone, then two sound waves (on) or a slash across it (off). Hand-wobbled
 * paths with round caps so it reads as a few quick strokes, not a UI glyph. Inherits the label colour.
 */
const SoundIcon = ({ on }: { on: boolean }) => (
	<svg width="30" height="24" viewBox="0 0 30 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
		<path d="M3.2 9.1 L8.4 8.7 L14.6 3.6 L14.9 20.6 L8.6 15.4 L3.1 15.1 Z" fill="currentColor" strokeWidth={1.6} />
		{on ? (
			<>
				<path d="M18.6 8.4 C20.4 10.3 20.5 13.6 18.7 15.7" strokeWidth={2.2} />
				<path d="M22.2 4.9 C26.1 8.6 26.3 15.3 22.4 19.2" strokeWidth={2.2} />
			</>
		) : (
			<path d="M19.4 7.6 L27.2 16.6 M27.0 7.4 L19.6 16.9" strokeWidth={2.3} />
		)}
	</svg>
);

const LANGS: [Lang, Lang] = ["it", "en"];
// Module constant: a stable identity, so the toggle doesn't re-register its stroke every render.
const LANG_OPTIONS: [InkSegmentOption, InkSegmentOption] = [
	{ label: "ITA", tone: "ink" },
	{ label: "ENG", tone: "ink" },
];

/**
 * The lobby's settings corner, pinned BOTTOM-LEFT on the entry gate and in the lobby, both still
 * InkStrokeButton strokes like every button:
 * - sound on/off (SFX + music): a speaker icon on a short stroke. Ink when on, ghost when off; the
 *   choice persists (`soundPref`). Switching on answers with a card flick, so the player hears it took.
 * - language: ITA | ENG on ONE segmented stroke (`langPref`, persisted); every string follows `useT`.
 */
export const SoundCorner = ({ visible = true }: { visible?: boolean }) => {
	const on = useSoundOn();
	const lang = useLang();
	const t = useT();
	const toggle = () => {
		soundPref.set(!on);
		if (!on) playSound("cardPick");
	};
	return (
		<div
			style={{
				position: "absolute",
				// The stroke's ink bleeds ~20px past the button box — keep that inside the screen.
				left: "max(28px, env(safe-area-inset-left, 0px))",
				bottom: "max(14px, env(safe-area-inset-bottom, 0px))",
				display: "flex",
				alignItems: "center",
				// Clear paper between the two strokes, so they read as two controls, not one long smear.
				gap: 28,
				pointerEvents: "auto",
			}}
		>
			<div style={{ width: 84 }}>
				{/* labelShift 0: the text shift compensates font metrics an SVG icon doesn't have (measured: the
				    icon sits on its stroke's centre unshifted, 4 px low with the text value). */}
				<InkStrokeButton tone={on ? "ink" : "ghost"} variant={2} visible={visible} onClick={toggle} style={{ height: 52 }} labelShift={0}>
					<span role="img" aria-label={on ? t("corner.soundOn") : t("corner.soundOff")} style={{ display: "inline-flex", verticalAlign: "middle" }}>
						<SoundIcon on={on} />
					</span>
				</InkStrokeButton>
			</div>
			<div style={{ width: 132 }} aria-label={t("corner.language")}>
				<InkSegmentedStroke
					options={LANG_OPTIONS}
					value={LANGS.indexOf(lang) as 0 | 1}
					onChange={(i) => langPref.set(LANGS[i])}
					variant={1}
					visible={visible}
					height={52}
					fontSize={13}
					letterSpacing={2}
				/>
			</div>
		</div>
	);
};

/** Secondary "go back" stroke (ghost tone), set apart from the main rows above it. */
export const BackStroke = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
	<InkStrokeButton tone="ghost" variant={2} onClick={onClick} style={{ marginTop: 22 }}>
		{children}
	</InkStrokeButton>
);
