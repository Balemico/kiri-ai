import { events } from "@react-three/fiber";
import type * as THREE from "three";

/** Event priority of an object: its own or nearest ancestor's `userData.eventPriority` (default 0). */
const priorityOf = (object: THREE.Object3D | null): number => {
	for (let o = object; o; o = o.parent) {
		const p = o.userData?.eventPriority;
		if (typeof p === "number") return p;
	}
	return 0;
};

/**
 * R3F pointer events with a PRIORITY before distance. By default the nearest hit wins — but the
 * set-aside card on the floor sits closer to the camera than the hand fan, so where their hover
 * zones overlap it stole the pointer: the hovered hand card dropped and the floor card lifted.
 * Objects (or their ancestors) declare `userData.eventPriority` — the hand fan is highest — and
 * hits are ordered by priority first, distance second (so within the hand the front-most card
 * still wins).
 */
export const prioritizedEvents: typeof events = (store) => ({
	...events(store),
	filter: (items: THREE.Intersection[]) => [...items].sort((a, b) => priorityOf(b.object) - priorityOf(a.object) || a.distance - b.distance),
});
