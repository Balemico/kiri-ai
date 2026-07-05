// Tiny sound system: preload the event mp3s and fire them on game events.
// Kept framework-free (plain HTMLAudioElement) so it stays out of the React/Three layers,
// mirroring how layout/texture helpers live as bare modules under src/common.

/** Logical sound events; each maps to one or more interchangeable files (picked at random). */
export type SoundName = "slash" | "miss" | "steps" | "clash";

/** Files live in `public/audio/` → served at `/audio/...`. */
const SOURCES: Record<SoundName, string[]> = {
	slash: ["slash_1.mp3", "slash_2.mp3"], // a strike lands
	miss: ["miss_1.mp3", "miss_2.mp3"], // an attack feints (whiffs)
	steps: ["steps_1.mp3", "steps_2.mp3"], // a pawn moves
	clash: ["clash.mp3"], // both blades meet (parry)
};

const AUDIO_BASE = "/audio/";

// One preloaded element per file; we clone it per play so overlapping sounds don't cut each other off.
const cache = new Map<string, HTMLAudioElement>();

const load = (file: string): HTMLAudioElement => {
	let el = cache.get(file);
	if (!el) {
		el = new Audio(AUDIO_BASE + file);
		el.preload = "auto";
		cache.set(file, el);
	}
	return el;
};

// Module-level settings, synced from the Leva "Game Audio" folder via useAudioControls.
let muted = false;
let volume = 1;

export const setAudioMuted = (value: boolean): void => {
	muted = value;
};

export const setAudioVolume = (value: number): void => {
	volume = Math.max(0, Math.min(1, value));
};

/** Warm the browser cache so the first event doesn't lag. Safe to call repeatedly. */
export const preloadSounds = (): void => {
	Object.values(SOURCES).flat().forEach(load);
};

let unlocked = false;

/**
 * Mobile browsers block audio until the page has had a user gesture. Call this synchronously from inside
 * the first real gesture (e.g. a pointerdown) to "unlock" the preloaded elements: a muted play→pause on
 * each satisfies the gesture requirement so later `playSound` calls (fired from game events, not gestures)
 * are allowed. Idempotent — a no-op after the first successful unlock.
 */
export const unlockAudio = (): void => {
	if (unlocked) return;
	unlocked = true;
	Object.values(SOURCES)
		.flat()
		.forEach((file) => {
			const el = load(file);
			const prevMuted = el.muted;
			el.muted = true;
			void el
				.play()
				.then(() => {
					el.pause();
					el.currentTime = 0;
					el.muted = prevMuted;
				})
				.catch(() => {
					el.muted = prevMuted;
				});
		});
};

const pick = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

/** Play one sound for the given event (random variant when several exist). No-op when muted. */
export const playSound = (name: SoundName): void => {
	if (muted || volume <= 0) return;
	const node = load(pick(SOURCES[name])).cloneNode(true) as HTMLAudioElement;
	node.volume = volume;
	// Autoplay can reject before the first user gesture — swallow it, the next event will succeed.
	void node.play().catch(() => {});
};
