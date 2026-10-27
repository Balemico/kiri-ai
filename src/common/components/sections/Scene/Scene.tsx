import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Leva, useControls } from "leva";
import { FitCamera, Lights, Floor, IntroFlight } from "../../atoms";
import { Battlefield } from "../Battlefield";
import { Stage } from "../Stage";
import { Hand } from "../Hand";
import { LandingZones } from "../LandingZones";
import { CardNameReveal } from "../CardNameReveal";
import { ConfirmButton } from "../ConfirmButton";
import { InkLayer } from "../InkLayer";
import { WinBanner } from "../WinBanner";
import { GameHud } from "../GameHud";
import { HudVignette } from "../HudVignette";
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
import { veilSignal } from "../../../ink/veilSignal";
import { duelIntro } from "../../../state/duelIntro";
import { prioritizedEvents } from "../../../eventPriority";

// The scene counts as ready once it renders this many consecutive smooth frames (< ~24 fps
// budget each) — or after a safety cap, so a slow device still gets revealed.
const STABLE_FRAMES = 6;
const SMOOTH_FRAME = 1 / 24;
const READY_CAP = 2.5;

/**
 * Fires `onReady` once the scene is not just mounted but SETTLED: mounting the duel compiles
 * shaders and decodes textures, so its first frames hitch. Waiting for a run of smooth frames
 * keeps those hitches under the ink veil — the reveal then plays fluidly.
 */
const ReadySignal = ({ onReady }: { onReady: () => void }) => {
	const state = useRef({ fired: false, smooth: 0, since: -1 });
	useFrame(({ clock }, dt) => {
		const k = state.current;
		if (k.fired) return;
		if (k.since < 0) k.since = clock.elapsedTime;
		k.smooth = dt < SMOOTH_FRAME ? k.smooth + 1 : 0;
		if (k.smooth >= STABLE_FRAMES || clock.elapsedTime - k.since > READY_CAP) {
			k.fired = true;
			onReady();
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
	// Approach reveal: everything is mounted at once (under the veil); the camera holds a farther
	// pose until the scene is ready (= the veil starts drying), then glides in. State initialiser
	// only — turn passing and orientation flips must NEVER re-run the entrance.
	const [flying, setFlying] = useState(entrance === "fly");
	const [ready, setReady] = useState(false);
	// On-screen entrances wait for the veil to have actually OPENED (see ink/veilSignal).
	const veilOpen = useSyncExternalStore(veilSignal.subscribe, veilSignal.isOpen);
	const showBoard = showInterface;
	const showHand = showInterface;
	return (
		<>
			{/* Paper fill behind everything — kept here (not only in Stage) so portrait, with the
			    Stage hidden, still has the floor's far edge dissolve into paper rather than black. */}
			<color attach="background" args={[PAPER]} />
			<Lights />
			{/* Single locked front view — no orbit; auto-fits the whole frame at any width. Yields the
			    camera to IntroFlight for the duration of the approach. */}
			<FitCamera frame={frame} enabled={!flying} />
			{flying && <IntroFlight frame={frame} start={ready} onDone={() => setFlying(false)} />}
			{/* Fires once the scene renders smoothly — releases the ink veil and starts the approach. */}
			<ReadySignal
				onReady={() => {
					setReady(true);
					onReady?.();
				}}
			/>
			{/* Background scenery (top-third parallax strip) — landscape only; dropped in portrait. */}
			{!isPortrait && <Stage frame={frame} />}
			{/* The tilted paper ground — lower half in landscape, full screen in portrait. */}
			<Floor frame={frame} controls={floor} orientation={orientation} />
			{/* Separate Suspense boundaries so a (re)loading hand never blanks the battlefield —
			    and card textures are preloaded (useCardTextures), so passing the turn doesn't suspend. */}
			{showBoard && (
				<>
					{/* Corner vignette behind the DOM HUD banners — in the scene so the cards paint over it. */}
					<HudVignette />
					<Suspense fallback={null}>
						{/* The paper samurai lie flat until the duel is revealed, then spring up. */}
						<Battlefield orientation={orientation} frame={frame} floorTilt={floor.tilt} standUp={entrance === "none" || (ready && veilOpen)} />
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
	/** "fly" = approach reveal (the camera glides in as the veil dries — IntroFlight); "none" = instant. */
	entrance?: "fly" | "none";
	/** Fired once the scene renders smoothly (a run of steady frames) — releases the ink veil. */
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
	// The duel-opening stage outlives the duel (module store): rewind it on leaving, so the next duel
	// opens with the samurai lying down again.
	useEffect(() => () => duelIntro.reset(), []);
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
			{/* prioritizedEvents: the hand fan always wins the pointer over cards lying on the table. */}
			<Canvas dpr={[1, 2]} camera={{ position: [0, 0, 6], fov: 30 }} events={prioritizedEvents}>
				<SceneContents showInterface={showInterface} entrance={entrance} onReady={onReady} />
			</Canvas>
		</>
	);
};
