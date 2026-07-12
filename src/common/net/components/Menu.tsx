import { useSession } from "../useSession";
import { InkStrokeButton } from "../../components/atoms";

/** Root screen: the two mode strokes floating on the panorama (the logo lives in Lobby's column). */
export const Menu = ({ onMultiplayer, delayFor, skipped }: { onMultiplayer: () => void; delayFor: (i: number) => number; skipped: boolean }) => {
	const { startLocal } = useSession();
	return (
		<>
			<InkStrokeButton onClick={startLocal} variant={0} seal delay={delayFor(2)} skipped={skipped}>
				PASSA E GIOCA
			</InkStrokeButton>
			<InkStrokeButton onClick={onMultiplayer} variant={1} delay={delayFor(3)} skipped={skipped}>
				MULTIPLAYER
			</InkStrokeButton>
			<p style={{ margin: "2px 0 0", fontSize: 12, opacity: 0.55, textAlign: "center", lineHeight: 1.5, color: "#17120e" }}>
				Passa e gioca sullo stesso dispositivo, oppure sfida un avversario online.
			</p>
		</>
	);
};
