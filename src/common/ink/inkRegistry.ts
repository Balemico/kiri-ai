/**
 * DOM ↔ ink-canvas bridge. A menu button can't render into the ink canvas (a different React
 * root), so it REGISTERS itself here; the InkLayer subscribes (useSyncExternalStore) and draws one
 * stroke per entry, tracking the element's on-screen rect every frame.
 */

export type InkTone = "ink" | "red" | "blue" | "ghost";

export interface InkStrokeEntry {
	id: number;
	el: HTMLElement;
	tone: InkTone;
	/** Brush variety: also seeds the stroke's shape. */
	variant: number;
	/** False until the choreography paints it; flipping true starts the pour. */
	visible: boolean;
	hovered: boolean;
	disabled: boolean;
	/** Seconds to wait after becoming visible before the stroke is laid (row stagger). */
	delay: number;
	/** A two-option toggle drawn as ONE stroke: the active half takes its tone, the other half
	 *  goes ghost (see InkSegmentedStroke). */
	segment?: { left: InkTone; right: InkTone; active: 0 | 1 };
}

let entries: InkStrokeEntry[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

let nextId = 1;
export const newInkStrokeId = (): number => nextId++;

export const inkStrokes = {
	subscribe: (listener: () => void) => {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	},
	getSnapshot: (): InkStrokeEntry[] => entries,
	upsert: (entry: InkStrokeEntry) => {
		const i = entries.findIndex((e) => e.id === entry.id);
		entries = i < 0 ? [...entries, entry] : entries.map((e) => (e.id === entry.id ? entry : e));
		emit();
	},
	remove: (id: number) => {
		entries = entries.filter((e) => e.id !== id);
		emit();
	},
};

let supported: boolean | null = null;

/** WebGPU, or WebGL2 for WebGPURenderer's fallback backend. Without either, buttons draw a CSS stroke. */
export const inkSupported = (): boolean => {
	if (supported !== null) return supported;
	if (typeof window === "undefined") return (supported = false);
	if ("gpu" in navigator) return (supported = true);
	try {
		supported = !!document.createElement("canvas").getContext("webgl2");
	} catch {
		supported = false;
	}
	return supported;
};

/** On-screen opacity of an element = the product of its ancestors' opacities (Motion fades). */
export const effectiveOpacity = (el: HTMLElement | null): number => {
	let o = 1;
	for (let n: HTMLElement | null = el; n && o > 0; n = n.parentElement) {
		const v = parseFloat(getComputedStyle(n).opacity);
		if (!Number.isNaN(v)) o *= v;
	}
	return o;
};
