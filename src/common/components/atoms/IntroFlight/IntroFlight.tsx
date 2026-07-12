import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";
import { BATTLEGROUND, INTRO, cameraPose, type SceneFrame } from "../../../layout";

export interface IntroFlightProps {
	frame: SceneFrame;
	onBoard: () => void;
	onHand: () => void;
	onDone: () => void;
}

/**
 * One-shot bird-view fly-back on scene mount: the camera starts close above the board looking
 * down and pulls back/levels to EXACTLY the FitCamera pose (`cameraPose` — shared math, so the
 * handoff has no jump). Reveal beats (`onBoard`, `onHand`) fire along the way. Resize-safe: the
 * end pose is re-read every frame from the live `size`/`frame` (no ref-write-during-render — see
 * `useFrame`, which re-subscribes with a fresh closure every render).
 */
export const IntroFlight = ({ frame, onBoard, onHand, onDone }: IntroFlightProps) => {
	const camera = useThree((s) => s.camera);
	const size = useThree((s) => s.size);
	const progress = useRef({ t: 0 });

	// The gsap timeline is built ONCE on mount (it's a one-shot cinematic). Its `.call`s read these
	// refs rather than closing over the props directly, so the effect has no reactive dependencies
	// even though the callbacks may be fresh on every render.
	const onBoardRef = useRef(onBoard);
	const onHandRef = useRef(onHand);
	const onDoneRef = useRef(onDone);
	useEffect(() => {
		onBoardRef.current = onBoard;
	}, [onBoard]);
	useEffect(() => {
		onHandRef.current = onHand;
	}, [onHand]);
	useEffect(() => {
		onDoneRef.current = onDone;
	}, [onDone]);

	useEffect(() => {
		const beats = gsap.timeline({ defaults: { overwrite: true } });
		beats.to(progress.current, { t: 1, duration: INTRO.flightDur, ease: "power3.inOut" }, 0);
		beats.call(() => onBoardRef.current(), undefined, INTRO.boardRevealAt);
		beats.call(() => onHandRef.current(), undefined, INTRO.handRevealAt);
		beats.call(() => onDoneRef.current(), undefined, INTRO.flightDur);
		return () => {
			beats.kill();
		};
	}, []);

	useFrame(() => {
		if (!(camera instanceof THREE.PerspectiveCamera)) return;
		const end = cameraPose(frame, size.width / size.height, camera.fov);
		const t = progress.current.t;
		// Start pose: near + high, staring down at the duel line.
		const startY = end.y + INTRO.flightStartHeight;
		const startZ = end.z * INTRO.flightStartDist;
		camera.position.set(0, startY + (end.y - startY) * t, startZ + (end.z - startZ) * t);
		// Look target: the board first, the frame centre at the end (level front view).
		const lookY = BATTLEGROUND.y + (end.y - BATTLEGROUND.y) * t;
		camera.lookAt(0, lookY, 0);
		camera.updateProjectionMatrix();
	});

	return null;
};
