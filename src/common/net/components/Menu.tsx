import { useSession } from "../useSession";
import { InkStrokeButton } from "../../components/atoms";

/**
 * Root screen: the two mode strokes floating on the panorama (the logo lives in Lobby's column).
 * `beat` is Lobby's choreography counter — each button paints on when its beat is reached
 * (buttons take beats 3 and 4; the calligraphy and logo take 1 and 2). A skip jumps all beats.
 */
export const Menu = ({ onMultiplayer, beat }: { onMultiplayer: () => void; beat: number }) => {
	const { startLocal } = useSession();
	return (
		<>
			<InkStrokeButton onClick={startLocal} variant={0} seal visible={beat > 2}>
				PASSA E GIOCA
			</InkStrokeButton>
			<InkStrokeButton onClick={onMultiplayer} variant={1} visible={beat > 3}>
				MULTIPLAYER
			</InkStrokeButton>
			<p style={{ margin: "2px 0 0", fontSize: 12, opacity: 0.55, textAlign: "center", lineHeight: 1.5, color: "#17120e" }}>
				Passa e gioca sullo stesso dispositivo, oppure sfida un avversario online.
			</p>
		</>
	);
};
