import { motion } from "motion/react";
import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { LOBBY } from "../../layout";

/** Washi-paper backdrop shared by every lobby screen (the same plate the 3D scene uses). */
export const Backdrop = ({ children }: { children: ReactNode }) => (
	<div
		style={{
			position: "fixed",
			inset: 0,
			zIndex: 3000,
			display: "grid",
			placeItems: "center",
			padding: 24,
			backgroundColor: "#e9e2d2",
			backgroundImage: "url(/images/backgroud/0-base.jpeg)",
			backgroundSize: "cover",
			backgroundPosition: "center",
		}}
	>
		{children}
	</div>
);

/** Rice-paper card that floats the lobby content. */
export const Panel = ({ children, title, subtitle }: { children: ReactNode; title?: string; subtitle?: string }) => (
	<motion.div
		initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
		animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
		transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
		style={{
			width: "min(420px, 100%)",
			display: "flex",
			flexDirection: "column",
			gap: 18,
			padding: "34px 30px",
			background: "rgba(24, 21, 18, 0.82)",
			border: "1px solid rgba(255, 255, 255, 0.12)",
			borderRadius: 18,
			backdropFilter: "blur(8px)",
			boxShadow: "0 18px 60px rgba(0, 0, 0, 0.45)",
			color: "#f2ead9",
		}}
	>
		{title && (
			<div style={{ textAlign: "center" }}>
				<h1 style={{ margin: 0, fontSize: 30, letterSpacing: 4, fontFamily: "var(--font-display)" }}>{title}</h1>
				{subtitle && <p style={{ margin: "8px 0 0", fontSize: 14, opacity: 0.7 }}>{subtitle}</p>}
			</div>
		)}
		{children}
	</motion.div>
);

interface InkButtonProps {
	children: ReactNode;
	onClick?: () => void;
	disabled?: boolean;
	tone?: "ink" | "red" | "blue" | "ghost";
	style?: CSSProperties;
}

const TONES: Record<NonNullable<InkButtonProps["tone"]>, string> = {
	ink: "#b73225",
	red: "#c0392b",
	blue: "#2f6f86",
	ghost: "rgba(255,255,255,0.10)",
};

/** Vermillion-seal action button used across the lobby. */
export const InkButton = ({ children, onClick, disabled, tone = "ink", style }: InkButtonProps) => (
	<motion.button
		type="button"
		disabled={disabled}
		onClick={onClick}
		whileHover={disabled ? undefined : { scale: 1.03 }}
		whileTap={disabled ? undefined : { scale: 0.97 }}
		transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
		style={{
			width: "100%",
			padding: "13px 18px",
			fontSize: 15,
			letterSpacing: 3,
			fontWeight: 700,
			color: "#f5ede0",
			background: TONES[tone],
			border: "1px solid rgba(255,255,255,0.14)",
			borderRadius: 999,
			cursor: disabled ? "default" : "pointer",
			opacity: disabled ? 0.4 : 1,
			...style,
		}}
	>
		{children}
	</motion.button>
);

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
		initial={{ opacity: 0, scale: 1.4 }}
		animate={{ opacity: 1, scale: 1 }}
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
			transform: "rotate(-2.5deg)",
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
				gap: 16,
				pointerEvents: "auto",
			}}
		>
			{children}
		</div>
	);
};
