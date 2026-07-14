/** Continuous ink wipe: the stroke/veil mask stays STATIC while a fill layer, itself masked
 *  by a pre-baked ragged ramp (`wipe-N.png`, solid left → bristled frontier → transparent
 *  right), slides across underneath via compositor-only `transform`. The reveal frontier
 *  therefore moves every screen frame — no discrete mask-frame steps, no crossfade flicker. */

/** Ramp width relative to the reveal box — keep in sync with WIPE_SCALE in scripts/ink_masks.py. */
export const WIPE_SCALE = 3;

/** CSS geometry of the sliding fill layer (percentages of the reveal box). */
export const WIPE_WIDTH = "300%";
export const WIPE_LEFT = "-200%";

export const inkWipeSrc = (variant: number): string => `/images/intro/wipe-${variant + 1}.png`;

/** translateX of the fill layer (CSS % of its OWN width) for a reveal progress 0..1: it
 *  starts fully left of the box and travels (SCALE−1)/SCALE of itself, parking its solid
 *  section over the box. */
export const wipeTravel = (progress: number): string => {
	const p = Math.min(1, Math.max(0, progress));
	return `${p * ((WIPE_SCALE - 1) / WIPE_SCALE) * 100}%`;
};

/** Warm mask images once — the first paint-on must never flash a blank mask. */
export const preloadInk = (srcs: string[]): void => {
	if (typeof window === "undefined") return;
	for (const s of srcs) new Image().src = s;
};
