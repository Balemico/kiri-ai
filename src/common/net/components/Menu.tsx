import { motion } from "motion/react";
import { useSession } from "../useSession";
import { InkStrokeButton, Stagger } from "../../components/atoms";
import { useT } from "../../i18n";

/**
 * Root screen: the two mode strokes floating on the panorama (the logo lives in Lobby's column).
 * `beat` is Lobby's choreography counter — each element paints on when its beat is reached (the
 * logo takes beat 1; the buttons take 2 and 3; the caption rides the last beat). A skip jumps
 * all beats.
 */
export const Menu = ({ onMultiplayer, beat }: { onMultiplayer: () => void; beat: number }) => {
	const { startLocal } = useSession();
	const t = useT();
	return (
		<Stagger>
			<InkStrokeButton onClick={startLocal} variant={0} visible={beat > 1}>
				{t("menu.passAndPlay")}
			</InkStrokeButton>
			<InkStrokeButton onClick={onMultiplayer} variant={1} visible={beat > 2}>
				{t("menu.multiplayer")}
			</InkStrokeButton>
			{/* Opacity lives in the variants (Motion owns it) — the caption is part of the choreography,
			    fading in just after the last stroke instead of sitting on the page from frame one. */}
			<motion.p
				variants={{
					hidden: { opacity: 0 },
					painted: { opacity: 0.55, transition: { delay: 0.25, duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
				}}
				initial="hidden"
				animate={beat > 2 ? "painted" : "hidden"}
				// Sits as far below the last stroke's ink as the logo sits above the first (≈48px of
				// clear paper): 34px + the stroke's own ~12px of air in its 70px box + the 2px row gap.
				style={{ margin: "34px 0 0", fontSize: 12, textAlign: "center", lineHeight: 1.5, color: "#17120e" }}
			>
				{t("menu.caption")}
			</motion.p>
		</Stagger>
	);
};
