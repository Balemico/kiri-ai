import { useLayoutEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import gsap from "gsap";

export interface RevealGroupProps {
	children: ReactNode;
	/** World units the content drops from ("the pieces settle down into place"). */
	drop?: number;
	delay?: number;
}

/** Mount entrance for a cluster of scene pieces: slides down `drop` units and settles. */
export const RevealGroup = ({ children, drop = 0.35, delay = 0 }: RevealGroupProps) => {
	const group = useRef<THREE.Group>(null);
	useLayoutEffect(() => {
		if (!drop) return;
		const g = group.current;
		if (!g) return;
		const tween = gsap.from(g.position, { y: `+=${drop}`, duration: 0.7, delay, ease: "power3.out", overwrite: true });
		return () => {
			tween.kill();
		};
	}, [drop, delay]);
	return <group ref={group}>{children}</group>;
};
