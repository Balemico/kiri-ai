import { useControls } from "leva";
import { DEFAULT_SCENE_FRAME, type SceneFrame } from "../layout";

/** Live-tunable scene-framing bounds for the locked camera, in their own Leva folder. */
export const useSceneFrame = (): SceneFrame =>
	useControls(
		"Scene Frame",
		{
			halfWidth: { value: DEFAULT_SCENE_FRAME.halfWidth, min: 1, max: 5, step: 0.05 },
			top: { value: DEFAULT_SCENE_FRAME.top, min: 0, max: 4, step: 0.05 },
			bottom: { value: DEFAULT_SCENE_FRAME.bottom, min: -5, max: 0, step: 0.05 },
		},
		{ collapsed: true },
	);
