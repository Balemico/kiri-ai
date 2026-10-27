import { motion } from "motion/react";
import { useSession } from "../useSession";
import { InkStrokeButton, Stagger } from "../../components/atoms";

/**
 * Root screen: the two mode strokes floating on the panorama (the logo lives in Lobby's column).
 * `beat` is Lobby's choreography counter — each element paints on when its beat is reached (the
 * logo takes beat 1; the buttons take 2 and 3; the caption rides the last beat). A skip jumps
 * all beats.
 */
export const Menu = ({ onMultiplayer, beat }: { onMultiplayer: () => void; beat: number }) => {
	const { startLocal } = useSession();
	return (
		<Stagger>
			<InkStrokeButton onClick={startLocal} variant={0} visible={beat > 1}>
				PASSA E GIOCA
			</InkStrokeButton>
			<InkStrokeButton onClick={onMultiplayer} variant={1} visible={beat > 2}>
				MULTIPLAYER
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
				style={{ margin: "2px 0 0", fontSize: 12, textAlign: "center", lineHeight: 1.5, color: "#17120e" }}
			>
				Passa e gioca sullo stesso dispositivo, oppure sfida un avversario online.
			</motion.p>
		</Stagger>
	);
};
