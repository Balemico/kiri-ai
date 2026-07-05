import type { CSSProperties } from "react";
import { HudPanel } from "../../molecules";

const overlayStyle: CSSProperties = {
	position: "fixed",
	top: 20,
	left: 20,
	background: "rgba(0, 0, 0, 0.8)",
	color: "white",
	padding: 20,
	borderRadius: 12,
	minWidth: 300,
	zIndex: 1000,
};

/** HTML overlay hosting the turn controls. */
export const TurnHud = () => (
	<div style={overlayStyle}>
		<HudPanel />
	</div>
);
