import { motion } from "motion/react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { LOBBY } from "../../layout";
import { InkStrokeButton } from "../../components/atoms";

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
export const LobbyColumn = ({ children }: { children: ReactNode }) => {
	const portrait = usePortraitWindow();
	return (
		<div
			style={{
				position: "absolute",
				top: 0,
				bottom: 0,
				right: portrait ? "50%" : "4%",
				transform: portrait ? "translateX(50%)" : "none",
				width: portrait ? "min(420px, 88vw)" : `${LOBBY.columnWidthPct}%`,
				maxWidth: 460,
				display: "flex",
				flexDirection: "column",
				justifyContent: "center",
				gap: 26,
				pointerEvents: "auto",
			}}
		>
			{children}
		</div>
	);
};

/** Secondary "go back" stroke (ghost tone), set apart from the main rows above it. */
export const BackStroke = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
	<InkStrokeButton tone="ghost" variant={2} onClick={onClick} style={{ marginTop: 22 }}>
		{children}
	</InkStrokeButton>
);
