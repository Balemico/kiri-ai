// Tiny sound system: preload the event mp3s and fire them on game events.
// Kept framework-free (plain HTMLAudioElement) so it stays out of the React/Three layers,
// mirroring how layout/texture helpers live as bare modules under src/common.

import { AUDIO } from "./layout";
import { soundPref } from "./state/soundPref";

/** Logical sound events; each maps to one or more interchangeable files (picked at random). */
export type SoundName = "slash" | "miss" | "steps" | "clash" | "cardDeal" | "cardPick" | "cardPlace" | "cardCover" | "veil" | "handoff" | "rise";

/** Files live in `public/audio/` → served at `/audio/...`. */
const SOURCES: Record<SoundName, string[]> = {
	slash: ["slash_1.mp3", "slash_2.mp3"], // a strike lands
	miss: ["miss_1.mp3", "miss_2.mp3"], // an attack feints (whiffs)
	steps: ["steps_1.mp3", "steps_2.mp3"], // a pawn moves
	clash: ["clash.mp3"], // both blades meet (parry)
	// Card clips, cut from the raw takes (cards.1 / cards.2) — soft slides vs. snappy flicks.
	cardDeal: Array.from({ length: 10 }, (_, i) => `cards/card_deal_${i + 1}.mp3`), // a card rises into the hand
	cardPick: Array.from({ length: 10 }, (_, i) => `cards/card_pick_${i + 1}.mp3`), // a card is lifted / selected
	cardPlace: ["cards/card_place.mp3"], // a card is laid in a slot
	cardCover: Array.from({ length: 5 }, (_, i) => `cards/card_cover_${i + 1}.mp3`), // a placed card turns face-down: real paper swish + tap (scripts/make_fx.sh)
	veil: ["transition/veil.mp3"], // the lobby→duel ink veil slashes across the screen
	handoff: ["transition/handoff.mp3"], // pass & play: the washi veil sweeps in / is lifted (veil.mp3, cropped + sped up 1.3×)
	rise: ["fx/rise.mp3"], // a paper cut-out is raised to its feet (scripts/make_fx.sh)
};

/**
 * Events that get a random per-play pitch/volume nudge (`AUDIO.pitchJitter` / `gainJitter`), so even the same
 * file never sounds twice the same — the card sounds fire in quick runs (deal cascade, sweeping the fan).
 */
const VARIED: ReadonlySet<SoundName> = new Set(["cardDeal", "cardPick", "cardPlace", "cardCover", "veil", "handoff", "rise"]);

/** Per-event gain on top of the master volume (synced from the Leva "Game Audio" folder). */
const gains: Partial<Record<SoundName, number>> = {
	cardDeal: AUDIO.cardDeal,
	cardPick: AUDIO.cardPick,
	cardPlace: AUDIO.cardPlace,
	cardCover: AUDIO.cardCover,
	veil: AUDIO.veil,
	handoff: AUDIO.handoff,
	rise: AUDIO.rise,
};

export const setSoundGain = (name: SoundName, value: number): void => {
	gains[name] = Math.max(0, Math.min(1, value));
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
let muted: boolean = AUDIO.muted;
let volume: number = AUDIO.volume;

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

// Last variant played per event, so a random pick never repeats it back to back.
const lastFile: Partial<Record<SoundName, string>> = {};

const pick = (name: SoundName): string => {
	const files = SOURCES[name];
	const pool = files.length > 1 ? files.filter((f) => f !== lastFile[name]) : files;
	const file = pool[Math.floor(Math.random() * pool.length)];
	lastFile[name] = file;
	return file;
};

/** Uniform random in [1 − amount, 1 + amount]. */
const jitter = (amount: number): number => 1 + (Math.random() * 2 - 1) * amount;

const lastPlayed: Partial<Record<SoundName, number>> = {};

/**
 * Play one sound for the given event (random variant when several exist). No-op when muted.
 * `throttleMs` drops the call if the same event fired less than that long ago (e.g. sweeping across the fan).
 */
export const playSound = (name: SoundName, throttleMs = 0): void => {
	const level = volume * (gains[name] ?? 1);
	if (muted || !soundPref.isOn() || level <= 0) return;
	const now = performance.now();
	if (throttleMs > 0 && now - (lastPlayed[name] ?? -Infinity) < throttleMs) return;
	lastPlayed[name] = now;
	const node = load(pick(name)).cloneNode(true) as HTMLAudioElement;
	if (VARIED.has(name)) {
		// Tape-style: the speed change shifts the pitch too (that IS the variation), so disable pitch correction.
		node.preservesPitch = false;
		node.playbackRate = jitter(AUDIO.pitchJitter);
		node.volume = Math.min(1, level * jitter(AUDIO.gainJitter));
	} else {
		node.volume = level;
	}
	// Autoplay can reject before the first user gesture — swallow it, the next event will succeed.
	void node.play().catch(() => {});
};
