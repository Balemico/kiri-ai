import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";
import { cameraPose, type SceneFrame } from "../../../layout";

export interface VictoryCameraProps {
	frame: SceneFrame;
	/** World x of the winner — the view centre drifts toward it. */
	focusX: number;
	/** Push-in duration (s). */
	duration: number;
	/** Fraction of the camera distance closed. */
	push: number;
	/** Fraction of `focusX` the view centre travels. */
	shift: number;
	/** World-Y the view centre rises. */
	lift: number;
}

/**
 * The closing push-in: starting EXACTLY on FitCamera's locked pose (`cameraPose`, shared math, so the
 * handoff has no jump), the camera closes slowly on the winner — a little nearer, the view centre
 * drifting toward it and up toward the figures. Owns the camera while mounted (FitCamera disabled);
 * resize-safe, the base pose is re-read every frame from the live `size`/`frame`.
 */
export const VictoryCamera = ({ frame, focusX, duration, push, shift, lift }: VictoryCameraProps) => {
	const camera = useThree((s) => s.camera);
	const size = useThree((s) => s.size);
	const progress = useRef({ t: 0 });

	useEffect(() => {
		const tween = gsap.to(progress.current, { t: 1, duration, ease: "sine.inOut", overwrite: true });
		return () => {
			tween.kill();
		};
		// Mount-only: one slow push per victory.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useFrame(() => {
		if (!(camera instanceof THREE.PerspectiveCamera)) return;
		const base = cameraPose(frame, size.width / size.height, camera.fov);
		const t = progress.current.t;
		const x = focusX * shift * t;
		const y = base.y + lift * t;
		camera.position.set(x, y, base.z * (1 - push * t));
		camera.lookAt(x, y, 0);
		camera.updateProjectionMatrix();
	});

	return null;
};
