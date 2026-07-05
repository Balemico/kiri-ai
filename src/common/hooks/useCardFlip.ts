import { useEffect, useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import * as THREE from "three";

/**
 * Flip a card's group to show its front (faceUp) or back.
 * Snaps on mount, animates on subsequent changes.
 */
export const useCardFlip = (faceUp: boolean) => {
	const ref = useRef<THREE.Group>(null);
	const mounted = useRef(false);

	useLayoutEffect(() => {
		if (ref.current) ref.current.rotation.z = faceUp ? 0 : Math.PI;
		mounted.current = true;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (!ref.current || !mounted.current) return;
		gsap.to(ref.current.rotation, { z: faceUp ? 0 : Math.PI, duration: 0.6, ease: "power2.inOut" });
	}, [faceUp]);

	return ref;
};
