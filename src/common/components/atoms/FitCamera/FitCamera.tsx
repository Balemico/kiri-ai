import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { cameraPose, DEFAULT_SCENE_FRAME, type SceneFrame } from "../../../layout";

export interface FitCameraProps {
	frame?: SceneFrame;
	/** False while a cinematic (IntroFlight) owns the camera — the fit is skipped, not fought. */
	enabled?: boolean;
}

/**
 * Locks the perspective camera to a single, fixed front view (no orbit / pan / zoom).
 * It dollies along z so the whole `frame` rectangle stays fully visible at any desktop
 * viewport width. The fit itself is `cameraPose` (pure, shared with IntroFlight so the
 * flight can land exactly on this pose).
 */
export const FitCamera = ({ frame = DEFAULT_SCENE_FRAME, enabled = true }: FitCameraProps) => {
	const camera = useThree((s) => s.camera);
	const size = useThree((s) => s.size);

	useLayoutEffect(() => {
		if (!enabled || !(camera instanceof THREE.PerspectiveCamera)) return;
		const pose = cameraPose(frame, size.width / size.height, camera.fov);
		camera.position.set(0, pose.y, pose.z);
		camera.lookAt(0, pose.y, 0);
		camera.updateProjectionMatrix();
	}, [camera, enabled, size.width, size.height, frame]);

	return null;
};
