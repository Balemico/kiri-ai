import type { CSSProperties, ReactNode } from "react";

export interface HudButtonProps {
	onClick: () => void;
	disabled?: boolean;
	color?: string;
	children: ReactNode;
}

/** Small styled HTML button used by the turn HUD overlay. */
export const HudButton = ({ onClick, disabled = false, color = "#16a34a", children }: HudButtonProps) => {
	const style: CSSProperties = {
		padding: "10px 20px",
		backgroundColor: disabled ? "#9ca3af" : color,
		color: "white",
		border: "none",
		borderRadius: "8px",
		cursor: disabled ? "not-allowed" : "pointer",
		fontSize: "16px",
		fontWeight: "bold",
	};
	return (
		<button onClick={onClick} disabled={disabled} style={style}>
			{children}
		</button>
	);
};
