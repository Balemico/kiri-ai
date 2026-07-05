import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DEFAULT_SCENE_FRAME, type SceneFrame } from "../../../layout";

export interface FitCameraProps {
	frame?: SceneFrame;
}

/**
 * Locks the perspective camera to a single, fixed front view (no orbit / pan / zoom).
 * It dollies along z so the whole `frame` rectangle stays fully visible at any desktop
 * viewport width: narrowing the window pulls the camera back instead of clipping the
 * side card slots or the hand. The camera looks straight down -z, so the view stays flat.
 */
export const FitCamera = ({ frame = DEFAULT_SCENE_FRAME }: FitCameraProps) => {
	const camera = useThree((s) => s.camera);
	const size = useThree((s) => s.size);

	useLayoutEffect(() => {
		if (!(camera instanceof THREE.PerspectiveCamera)) return;
		const aspect = size.width / size.height;
		const halfHeight = (frame.top - frame.bottom) / 2;
		const centerY = (frame.top + frame.bottom) / 2;
		const tan = Math.tan((camera.fov * Math.PI) / 360); // tan(vFov / 2)

		// Distance that fits the frame vertically, and the one that fits it horizontally
		// at the current aspect — take the larger so neither axis is ever clipped.
		const distForHeight = halfHeight / tan;
		const distForWidth = frame.halfWidth / (tan * aspect);
		const dist = Math.max(distForHeight, distForWidth);

		camera.position.set(0, centerY, dist);
		camera.lookAt(0, centerY, 0);
		camera.updateProjectionMatrix();
	}, [camera, size.width, size.height, frame.top, frame.bottom, frame.halfWidth]);

	return null;
};
