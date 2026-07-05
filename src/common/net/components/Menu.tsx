import { motion } from "motion/react";
import { useSession } from "../useSession";
import { Panel, InkButton } from "./ui";

/** Root screen: brand logo hero, then choose pass & play (default) or go to the multiplayer lobby. */
export const Menu = ({ onMultiplayer }: { onMultiplayer: () => void }) => {
	const { startLocal } = useSession();
	return (
		<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26, width: "min(680px, 100%)" }}>
			<motion.img
				src="/images/logo/kiri-ai-logo.png"
				alt="Kiri-ai: The Duel"
				initial={{ opacity: 0, y: -16, filter: "blur(6px)" }}
				animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
				transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
				style={{ width: "100%", height: "auto", display: "block", filter: "drop-shadow(0 6px 18px rgba(0, 0, 0, 0.45))" }}
			/>
			<Panel>
				<InkButton onClick={startLocal}>PASSA E GIOCA</InkButton>
				<InkButton tone="blue" onClick={onMultiplayer}>
					MULTIPLAYER
				</InkButton>
				<p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.55, textAlign: "center", lineHeight: 1.5 }}>
					Passa e gioca sullo stesso dispositivo, oppure sfida un avversario online.
				</p>
			</Panel>
		</div>
	);
};
