import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";
import { INTRO, cameraPose, type SceneFrame } from "../../../layout";

export interface IntroFlightProps {
	frame: SceneFrame;
	/** False = hold the start pose (the scene is still under the veil); true = glide in. */
	start: boolean;
	onDone: () => void;
}

/**
 * Approach reveal on game entry: the camera holds a pose a little farther and higher than the
 * game view, then — once `start` (the veil begins to dry) — glides in to EXACTLY the FitCamera
 * pose (`cameraPose`, shared math, so the handoff has no jump). Looking at the frame centre
 * throughout, so it tilts slightly down at first and levels out as it arrives. Resize-safe: the
 * end pose is re-read every frame from the live `size`/`frame`.
 */
export const IntroFlight = ({ frame, start, onDone }: IntroFlightProps) => {
	const camera = useThree((s) => s.camera);
	const size = useThree((s) => s.size);
	const progress = useRef({ t: 0 });
	const onDoneRef = useRef(onDone);
	useEffect(() => {
		onDoneRef.current = onDone;
	}, [onDone]);

	useEffect(() => {
		if (!start) return;
		const tween = gsap.to(progress.current, { t: 1, duration: INTRO.flightDur, ease: "power2.out", overwrite: true, onComplete: () => onDoneRef.current() });
		return () => {
			tween.kill();
		};
	}, [start]);

	useFrame(() => {
		if (!(camera instanceof THREE.PerspectiveCamera)) return;
		const end = cameraPose(frame, size.width / size.height, camera.fov);
		const t = progress.current.t;
		const startY = end.y + INTRO.flightStartHeight;
		const startZ = end.z * INTRO.flightStartDist;
		camera.position.set(0, startY + (end.y - startY) * t, startZ + (end.z - startZ) * t);
		camera.lookAt(0, end.y, 0);
		camera.updateProjectionMatrix();
	});

	return null;
};
