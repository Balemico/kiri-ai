import { Suspense, useCallback, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Leva } from "leva";
import gsap from "gsap";
import * as THREE from "three";
import { FitCamera, Floor, FallingLeaves, Mist, ParallaxLayer } from "../../atoms";
import { useFloorControls } from "../../../hooks/useFloorControls";
import { useLobbyControls } from "../../../hooks/useLobbyControls";
import { useCoarsePointer } from "../../../hooks/useCoarsePointer";
import { DEFAULT_SCENE_FRAME, INTRO, LOBBY, PAPER, STAGE, STAGE_LAYERS, frameViewport } from "../../../layout";

const TREE_URL = "/images/backgroud/4-tree.png";

/** The shared painting minus the tree (the lobby re-stages it), same paint order as Stage. */
const SHARED_LAYERS = STAGE_LAYERS.filter((l) => l.url !== TREE_URL);

/** Total layer materials the cinematic waits for: the shared layers plus the re-staged tree. */
const EXPECTED_MATERIALS = STAGE_LAYERS.length;

export interface LobbySceneProps {
	/** False = skip the cinematic entirely (reduced motion / intro already played). */
	intro: boolean;
	registerSkip: (skip: () => void) => void;
	onIntroEnd: () => void;
	/** True = cap the leaf field to LOBBY.leaves.reducedCount (prefers-reduced-motion / low-end). */
	reducedLeaves?: boolean;
}

interface PanoramaProps extends LobbySceneProps {
	leafVisibleRef: MutableRefObject<boolean>;
}

/**
 * The lobby's living panorama: the game's stage art re-staged (tree pulled LEFT and enlarged —
 * it is the leaves' source), plus mist and the falling leaves. The entry cinematic is ONE gsap
 * timeline over the layer materials (paint-on far → near) so a tap can `progress(1)` all of it.
 */
const Panorama = ({ intro, registerSkip, onIntroEnd, reducedLeaves, leafVisibleRef }: PanoramaProps) => {
	const c = useLobbyControls();
	const size = useThree((s) => s.size);
	const frame = DEFAULT_SCENE_FRAME;
	const floor = useFloorControls("landscape");

	// Panorama sizing — mirrors Stage (visible width, native aspect), but on the LOBBY's deeper
	// horizon: more painting, less bare paper below the menu.
	const horizonY = frame.top - (frame.top - frame.bottom) * LOBBY.horizonFraction;
	const vp = frameViewport(frame, size.width / size.height);
	const visibleWidth = vp.width;
	const width = visibleWidth * STAGE.widthOverscan * STAGE.scale;
	const height = width / STAGE.imageAspect;
	const centerY = (frame.top + horizonY) / 2 + STAGE.lift;

	// The tree art is a full-frame panel with the tree far bottom-left INSIDE the frame: anchor
	// its measured footprint (LOBBY.treeAnchor) to TWO view edges — mass centre `treeEdge` inside
	// the LEFT edge, painted base `treeBottom` above the BOTTOM edge — so the tree hugs the corner
	// identically at any aspect (a raw panel offset would drift with the panel width).
	// worldX(f) = centerX + (f − 0.5)·W, worldY(f) = centerY + (0.5 − f)·H.
	const treeWorldX = -visibleWidth / 2 + c.treeEdge;
	const treeWidth = width * c.treeScale;
	const treeHeight = treeWidth / STAGE.imageAspect;
	const treeCenterX = treeWorldX - (LOBBY.treeAnchor.x - 0.5) * treeWidth;
	const treeCenterY = vp.bottom + c.treeBottom + (LOBBY.treeAnchor.bottom - 0.5) * treeHeight;

	// --- Entry cinematic: collect layer materials, then build one master timeline. ---
	const materials = useRef(new Map<string, THREE.MeshBasicMaterial>());
	const timeline = useRef<gsap.core.Timeline | null>(null);
	const done = useRef(!intro);

	const finish = useCallback(() => {
		if (done.current) return;
		done.current = true;
		timeline.current?.progress(1);
		leafVisibleRef.current = true;
		onIntroEnd();
	}, [leafVisibleRef, onIntroEnd]);

	useEffect(() => {
		registerSkip(finish);
	}, [registerSkip, finish]);

	const onLayerMaterial = useCallback(
		(url: string) => (mat: THREE.MeshBasicMaterial) => {
			if (done.current) return; // intro over (or off): leave everything fully painted
			mat.opacity = 0;
			materials.current.set(url, mat);
			if (materials.current.size < EXPECTED_MATERIALS || timeline.current) return;
			// All layers ready → paint them on far → near, then release the leaves, then hand off to the DOM.
			const tl = gsap.timeline({ defaults: { ease: "power2.out", overwrite: true } });
			[...materials.current.entries()].forEach(([, m], i) => {
				tl.to(m, { opacity: 1, duration: INTRO.layerFade }, i * INTRO.layerStagger);
			});
			tl.call(
				() => {
					leafVisibleRef.current = true;
				},
				undefined,
				INTRO.leavesDelay,
			);
			tl.call(finish, undefined, Math.max(tl.duration(), INTRO.total));
			timeline.current = tl;
		},
		[finish, leafVisibleRef],
	);

	useEffect(
		() => () => {
			timeline.current?.kill();
		},
		[],
	);

	// Memoized so FallingLeaves' internal per-cfg split cache survives unrelated re-renders.
	// The emitter FOLLOWS the tree (canopy offset from its mass centre) — moving or reanchoring
	// the tree never orphans the leaves.
	const leafCfg = useMemo(
		() => ({
			...LOBBY.leaves,
			emitterX: treeWorldX + LOBBY.treeCanopyOffsetX,
			count: reducedLeaves ? LOBBY.leaves.reducedCount : c.leafCount,
			windStrength: c.windStrength,
			drift: c.drift,
			fallSpeed: c.fallSpeed,
		}),
		[c.leafCount, c.windStrength, c.drift, c.fallSpeed, reducedLeaves, treeWorldX],
	);

	return (
		<>
			<color attach="background" args={[PAPER]} />
			<FitCamera frame={frame} />
			<Suspense fallback={null}>
				{SHARED_LAYERS.map((layer, i) => (
					<ParallaxLayer
						key={layer.url}
						url={layer.url}
						depth={layer.depth}
						phase={layer.phase}
						z={STAGE.planeZ}
						renderOrder={-100 + i}
						width={width}
						height={height}
						centerY={centerY + (layer.y ?? 0)}
						parallaxX={STAGE.parallaxX}
						parallaxY={STAGE.parallaxY}
						driftAmp={STAGE.driftAmp}
						driftSpeed={STAGE.driftSpeed}
						onMaterial={onLayerMaterial(layer.url)}
					/>
				))}
				{/* The maple tree, re-staged: left edge, enlarged, TRUE foreground — drawn ABOVE the floor
				    (unlike the in-game tree) so its base stands on the ground instead of dissolving into
				    the horizon wash. Still behind the front leaves (5). */}
				<ParallaxLayer
					url={TREE_URL}
					depth={0.62}
					phase={0.6}
					z={STAGE.planeZ + 0.02}
					renderOrder={-5}
					width={treeWidth}
					height={treeHeight}
					centerY={treeCenterY}
					centerX={treeCenterX}
					parallaxX={STAGE.parallaxX}
					parallaxY={STAGE.parallaxY}
					driftAmp={STAGE.driftAmp}
					driftSpeed={STAGE.driftSpeed}
					onMaterial={onLayerMaterial(TREE_URL)}
				/>
				<Floor frame={frame} controls={floor} orientation="landscape" horizonFraction={LOBBY.horizonFraction} />
			</Suspense>
			<Mist bands={LOBBY.mist.bands} opacity={c.mistOpacity} speed={c.mistSpeed} height={LOBBY.mist.height} y={horizonY + LOBBY.mist.y} width={visibleWidth * 1.2} />
			{/* The field's own clock starts when the ref flips true — an empty canopy shedding leaves
			    one by one (leafPose staggers detachment from t=0), never a mid-air switch-on. */}
			<FallingLeaves cfg={leafCfg} armedRef={leafVisibleRef} />
		</>
	);
};

/** Static washi fallback when WebGL is unavailable — the menu must always work. */
const StaticFallback = () => (
	<div
		style={{
			position: "absolute",
			inset: 0,
			backgroundColor: "#e9e2d2",
			backgroundImage: "url(/images/backgroud/complete.jpeg)",
			backgroundSize: "cover",
			backgroundPosition: "center",
		}}
	/>
);

/** The lobby's animated backdrop canvas. Fills its parent; pointer events pass through to the page. */
export const LobbyScene = ({ intro, registerSkip, onIntroEnd, reducedLeaves }: LobbySceneProps) => {
	const coarse = useCoarsePointer();
	const leafVisibleRef = useRef(!intro);
	return (
		<>
			{/* OUTSIDE the click-through wrapper: `pointer-events` is inherited, so mounted inside it
			    the debug panel would render but ignore every click. */}
			<Leva collapsed hidden={import.meta.env.PROD || coarse} />
			<div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
				<Canvas dpr={coarse ? [1, 1.5] : [1, 2]} camera={{ position: [0, 0, 6], fov: 30 }} fallback={<StaticFallback />}>
					<Panorama intro={intro} registerSkip={registerSkip} onIntroEnd={onIntroEnd} reducedLeaves={reducedLeaves} leafVisibleRef={leafVisibleRef} />
				</Canvas>
			</div>
		</>
	);
};
