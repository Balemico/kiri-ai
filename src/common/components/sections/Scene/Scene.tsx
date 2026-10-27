import { Suspense, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Leva, useControls } from "leva";
import { FitCamera, Lights, Floor, IntroFlight, RevealGroup } from "../../atoms";
import { Battlefield } from "../Battlefield";
import { Stage } from "../Stage";
import { Hand } from "../Hand";
import { LandingZones } from "../LandingZones";
import { CardNameReveal } from "../CardNameReveal";
import { ConfirmButton } from "../ConfirmButton";
import { InkLayer } from "../InkLayer";
import { WinBanner } from "../WinBanner";
import { GameHud } from "../GameHud";
import { HandoffVeil } from "../HandoffVeil";
import { StrikeSplash } from "../StrikeSplash";
import { WaitingOverlay } from "../../../net";
import { useSceneFrame } from "../../../hooks/useSceneFrame";
import { useFloorControls } from "../../../hooks/useFloorControls";
import { useAudioControls } from "../../../hooks/useAudioControls";
import { useCombatAudio } from "../../../hooks/useCombatAudio";
import { useAutoReveal } from "../../../hooks/useAutoReveal";
import { useCoarsePointer } from "../../../hooks/useCoarsePointer";
import { PAPER, PORTRAIT_SCENE_FRAME } from "../../../layout";

/** Fires `onReady` on the first rendered frame — the veil holds until the scene truly exists. */
const ReadySignal = ({ onReady }: { onReady?: () => void }) => {
	const fired = useRef(false);
	useFrame(() => {
		if (!fired.current) {
			fired.current = true;
			onReady?.();
		}
	});
	return null;
};

/**
 * Everything that lives inside the R3F canvas. Orientation is derived from the SAME `size` all the
 * scene geometry reads (`useThree(s => s.size)`), NOT a separate `matchMedia` window query. Those are
 * two independent reactive sources that don't update in the same React commit, so on a resize across
 * the portrait/landscape boundary they would briefly disagree — the pieces got laid out with the new
 * orientation against the old aspect (and vice versa), which dislocated them. Reading one source keeps
 * the orientation flag and the aspect always consistent within a render.
 */
const SceneContents = ({
	showInterface,
	entrance,
	onReady,
}: {
	showInterface: boolean;
	entrance: "fly" | "none";
	onReady?: () => void;
}) => {
	const size = useThree((s) => s.size);
	// Portrait = canvas taller than (or as tall as) wide — same convention as `(orientation: portrait)`.
	const isPortrait = size.height >= size.width;
	const orientation = isPortrait ? "portrait" : "landscape";
	const landscapeFrame = useSceneFrame();
	// Portrait (window taller than wide): drop the background, the floor fills the screen and the
	// battleground turns vertical. A separate, taller/narrower frame keeps the vertical line framed.
	const frame = isPortrait ? PORTRAIT_SCENE_FRAME : landscapeFrame;
	// Floor controls are shared so the battleground can rake its pieces onto the SAME tilt the floor uses.
	const floor = useFloorControls(orientation);
	// Fly-back reveal staging: 0 = scenery only, 1 = + board, 2 = + hand (= everything). Portrait
	// skips the flight (the bird view is designed around the landscape composition). State
	// initialisers only — turn passing and orientation flips must NEVER re-run the staging.
	const fly = entrance === "fly" && !isPortrait;
	const [stage, setStage] = useState(fly ? 0 : 2);
	const [flying, setFlying] = useState(fly);
	const showBoard = showInterface && stage >= 1;
	const showHand = showInterface && stage >= 2;
	return (
		<>
			{/* Paper fill behind everything — kept here (not only in Stage) so portrait, with the
			    Stage hidden, still has the floor's far edge dissolve into paper rather than black. */}
			<color attach="background" args={[PAPER]} />
			<Lights />
			{/* Single locked front view — no orbit; auto-fits the whole frame at any width. Yields the
			    camera to IntroFlight for the duration of the fly-back reveal. */}
			<FitCamera frame={frame} enabled={!flying} />
			{flying && (
				<IntroFlight
					frame={frame}
					onBoard={() => setStage((s) => Math.max(s, 1))}
					onHand={() => setStage((s) => Math.max(s, 2))}
					onDone={() => setFlying(false)}
				/>
			)}
			{/* Fires once the canvas has produced its first frame — releases the ink veil. */}
			<ReadySignal onReady={onReady} />
			{/* Background scenery (top-third parallax strip) — landscape only; dropped in portrait. */}
			{!isPortrait && <Stage frame={frame} />}
			{/* The tilted paper ground — lower half in landscape, full screen in portrait. */}
			<Floor frame={frame} controls={floor} orientation={orientation} />
			{/* Separate Suspense boundaries so a (re)loading hand never blanks the battlefield —
			    and card textures are preloaded (useCardTextures), so passing the turn doesn't suspend. */}
			{showBoard && (
				<>
					<Suspense fallback={null}>
						<RevealGroup drop={fly ? 0.4 : 0}>
							<Battlefield orientation={orientation} frame={frame} floorTilt={floor.tilt} />
						</RevealGroup>
					</Suspense>
					{/* Portrait placeholders marking where each team's played / set-aside cards land. */}
					<LandingZones frame={frame} orientation={orientation} />
				</>
			)}
			{showHand && (
				<>
					<Suspense fallback={null}>
						<Hand frame={frame} orientation={orientation} />
					</Suspense>
					{/* Floating card name above each revealed card, in the player's colour. */}
					<CardNameReveal frame={frame} orientation={orientation} />
				</>
			)}
		</>
	);
};

export interface SceneProps {
	/** "fly" = bird-view fly-back reveal on mount (Task: IntroFlight); "none" = instant (default). */
	entrance?: "fly" | "none";
	/** Fired once the canvas has produced its first frame — releases the ink veil. */
	onReady?: () => void;
}

/** Top-level view: the 3D canvas plus the HTML overlays. */
export const Scene = ({ entrance = "none", onReady }: SceneProps) => {
	// Toggle the whole game interface (hand, HUD, toasts) off to focus on the background scene.
	const { showInterface } = useControls("Game UI", { showInterface: { value: true, label: "show interface" } }, { collapsed: true });
	// Sound effects play on resolved actions regardless of the interface toggle.
	useAudioControls();
	useCombatAudio();
	// Once both players confirm, the reveal sequence plays out automatically every 2s.
	useAutoReveal();
	// The debug panel is for tuning on desktop — hide it in production and on touch (no room, no mouse).
	const coarse = useCoarsePointer();
	return (
		<>
			<Leva collapsed hidden={import.meta.env.PROD || coarse} />
			{showInterface && (
				<>
					<GameHud />
					{/* Sumi strokes of the action button: over the duel canvas, under its label (1500). */}
					<InkLayer zIndex={1450} />
					<ConfirmButton />
				</>
			)}
			{/* Ink splash on a landed hit / flash on a clash — feedback, so shown with the interface off too. */}
			<StrikeSplash />
			{/* Pass & play: covers the table while the device changes hands (no-op online). */}
			<HandoffVeil />
			{/* Online: "waiting for opponent" pill after you've confirmed (no-op in pass & play). */}
			<WaitingOverlay />
			{/* Victory title — shown on game-over regardless of the interface toggle. */}
			<WinBanner />
			{/* Cap the device pixel ratio: high-DPR phones would render 3–4× the pixels, draining GPU/battery
			    for no visible gain. dpr={[1, 2]} keeps it crisp while bounding the fill cost. */}
			<Canvas dpr={[1, 2]} camera={{ position: [0, 0, 6], fov: 30 }}>
				<SceneContents showInterface={showInterface} entrance={entrance} onReady={onReady} />
			</Canvas>
		</>
	);
};
