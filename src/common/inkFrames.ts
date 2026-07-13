/** Frame math for the ink paint-on: which two mask frames to stack and how to blend them.
 *  Frames are monotonic (frame b contains frame a), so fading b in over a only ever ADDS
 *  the newly-painted delta — 12 steps read as one continuous stroke. */
export interface InkFrameBlend {
	/** 0-based index of the fully-shown frame. */
	a: number;
	/** Index of the incoming frame (=== a on the last frame). */
	b: number;
	/** Opacity of frame b, in [0, 1). */
	blend: number;
}

export const inkFrameBlend = (progress: number, frameCount: number): InkFrameBlend => {
	const p = Math.min(1, Math.max(0, progress)) * (frameCount - 1);
	const a = Math.floor(p);
	return { a, b: Math.min(a + 1, frameCount - 1), blend: p - a };
};

/** 0-based frame index -> the file emitted by scripts/ink_masks.py (1-based, zero-padded). */
export const inkFrameSrc = (name: string, frame: number): string =>
	`/images/intro/frames/${name}-f${String(frame + 1).padStart(2, "0")}.png`;

/** Warm every frame of a stroke once — the first paint-on must never flash a blank mask. */
export const preloadInkFrames = (name: string, frameCount: number): void => {
	if (typeof window === "undefined") return;
	for (let f = 0; f < frameCount; f++) new Image().src = inkFrameSrc(name, f);
};
