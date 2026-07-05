import { Suspense } from "react";
import { useThree } from "@react-three/fiber";
import { useControls } from "leva";
import { ParallaxLayer } from "../../atoms";
import { STAGE, STAGE_LAYERS, HORIZON_FRACTION, frameViewport, type SceneFrame } from "../../../layout";

/**
 * The background scenery: the full sumi-e painting fitted (by height, at NATIVE aspect — no
 * stretching) into the strip above the horizon, parallaxing with the pointer and drifting
 * slowly. Always on, behind the floor and the interface. Tunables: the "Stage" Leva folder.
 */
export const Stage = ({ frame }: { frame: SceneFrame }) => {
	const c = useControls(
		"Stage",
		{
			scale: { value: STAGE.scale, min: 0.5, max: 2, step: 0.02 },
			yNudge: { value: STAGE.lift, min: -1, max: 1.5, step: 0.02 },
			parallaxX: { value: STAGE.parallaxX, min: 0, max: 1, step: 0.01 },
			parallaxY: { value: STAGE.parallaxY, min: 0, max: 0.5, step: 0.01 },
			driftAmp: { value: STAGE.driftAmp, min: 0, max: 0.3, step: 0.005 },
			driftSpeed: { value: STAGE.driftSpeed, min: 0, max: 0.5, step: 0.01 },
		},
		{ collapsed: true },
	);

	const size = useThree((s) => s.size);
	const horizonY = frame.top - (frame.top - frame.bottom) * HORIZON_FRACTION;
	// Cover the actual visible width (NOT frame.halfWidth, which tracks the gameplay cluster and
	// shrinks with smaller cards) so the scenery always reaches both page edges. Native aspect (no
	// stretch); the painting spills below the horizon where the floor masks it.
	const visibleWidth = frameViewport(frame, size.width / size.height).width;
	const width = visibleWidth * STAGE.widthOverscan * c.scale;
	const height = width / STAGE.imageAspect;
	const centerY = (frame.top + horizonY) / 2 + c.yNudge;

	return (
		<>
			{/* Cream background fill is attached in Scene (so it survives the Stage being hidden in portrait). */}
			<Suspense fallback={null}>
				{STAGE_LAYERS.map((layer, i) => (
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
						parallaxX={c.parallaxX}
						parallaxY={c.parallaxY}
						driftAmp={c.driftAmp}
						driftSpeed={c.driftSpeed}
					/>
				))}
			</Suspense>
		</>
	);
};
