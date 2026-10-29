// Background music: one random track per scene (lobby / battle), faded in and out, crossfaded on a
// scene change and between consecutive tracks. Framework-free like audio.ts (the SFX module).
//
// Tracks are STREAMED by an HTMLAudioElement (a 5-minute track decoded into an AudioBuffer would cost
// ~100 MB on a phone) and routed through a Web Audio GainNode per track — the fades are gain ramps,
// because iOS ignores `HTMLMediaElement.volume`. Files are produced by scripts/encode_music.sh
// (loudness-normalised, Opus/WebM with an AAC/M4A fallback).

import { MUSIC } from "./layout";
import { soundPref } from "./state/soundPref";

/** `showdown` = both players on their last life; `end` = the victory screen. */
export type MusicScene = "lobby" | "battle" | "showdown" | "end";

/** Files live in `public/audio/music/` as `<name>.webm` + `<name>.m4a`. */
const PLAYLISTS: Record<MusicScene, string[]> = {
	lobby: ["lobby.1", "lobby.2", "lobby.3"],
	battle: ["battle.1", "battle.2", "battle.3", "battle.4"],
	showdown: ["showdown.1", "showdown.2"],
	end: ["end"], // a single track: it crossfades into itself at the end, i.e. it loops
};

const MUSIC_BASE = "/audio/music/";

/** Random pick that avoids repeating `avoid` whenever there is another choice. Pure — unit-tested. */
export const pickTrack = (tracks: readonly string[], avoid?: string, rand: () => number = Math.random): string => {
	const pool = tracks.length > 1 ? tracks.filter((t) => t !== avoid) : tracks;
	return pool[Math.floor(rand() * pool.length)];
};

// Module-level settings, synced from the Leva "Music" folder via useMusicControls.
const settings: { muted: boolean; volume: number; fadeIn: number; fadeOut: number; crossfade: number } = { ...MUSIC };

interface Deck {
	el: HTMLAudioElement;
	gain: GainNode | null;
	source: MediaElementAudioSourceNode | null;
	faded: boolean; // fade-in already started (a resume after a pause must not fade again)
	ending: boolean; // fading out — no longer the current track
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let current: Deck | null = null;
let sceneId: string | null = null;
let scene: MusicScene | null = null;
const live = new Set<Deck>();
const lastTrack: Partial<Record<MusicScene, string>> = {};
let extension: "webm" | "m4a" | null = null;
let initialised = false;

const fileExtension = (): "webm" | "m4a" => {
	if (!extension) {
		const probe = document.createElement("audio");
		extension = probe.canPlayType('audio/webm; codecs="opus"') ? "webm" : "m4a";
	}
	return extension;
};

const running = () => !ctx || ctx.state === "running";

const masterLevel = () => (settings.muted || !soundPref.isOn() ? 0 : settings.volume);

/** Linear gain ramp from the current value, replacing any ramp still in flight. */
const rampTo = (param: AudioParam, target: number, seconds: number) => {
	if (!ctx) return;
	const t = ctx.currentTime;
	param.cancelScheduledValues(t);
	param.setValueAtTime(param.value, t);
	param.linearRampToValueAtTime(target, t + Math.max(0.01, seconds));
};

const play = (deck: Deck) => {
	// Autoplay policy: wait for the unlock gesture rather than play into a suspended context.
	if (!running() || document.hidden) return;
	void deck.el.play().catch(() => {});
};

const dispose = (deck: Deck) => {
	live.delete(deck);
	deck.el.pause();
	deck.el.removeAttribute("src");
	deck.el.load(); // drops the stream / buffered data
	deck.source?.disconnect();
	deck.gain?.disconnect();
};

const fadeOut = (deck: Deck, seconds: number) => {
	deck.ending = true;
	if (!deck.gain || deck.el.paused) {
		dispose(deck);
		return;
	}
	rampTo(deck.gain.gain, 0, seconds);
	window.setTimeout(() => dispose(deck), seconds * 1000 + 150);
};

const startTrack = (s: MusicScene, fadeInSeconds: number): Deck => {
	const track = pickTrack(PLAYLISTS[s], lastTrack[s]);
	lastTrack[s] = track;
	const el = new Audio(`${MUSIC_BASE}${track}.${fileExtension()}`);
	el.preload = "auto";
	const deck: Deck = { el, gain: null, source: null, faded: false, ending: false };
	if (ctx && master) {
		deck.source = ctx.createMediaElementSource(el);
		deck.gain = ctx.createGain();
		deck.gain.gain.value = 0;
		deck.source.connect(deck.gain).connect(master);
	} else {
		el.volume = masterLevel(); // no Web Audio: no fades, just the level
	}
	// The fade starts when sound actually flows (streaming / the unlock gesture can delay it).
	el.addEventListener("playing", () => {
		if (deck.faded || deck.ending || !deck.gain) return;
		deck.faded = true;
		rampTo(deck.gain.gain, 1, fadeInSeconds);
	});
	// Fade out the last seconds while the next pick fades in over them.
	el.addEventListener("timeupdate", () => {
		if (deck.ending || deck !== current || !Number.isFinite(el.duration)) return;
		if (el.duration - el.currentTime <= settings.fadeOut) advance();
	});
	el.addEventListener("ended", () => {
		if (deck === current) advance();
		else dispose(deck);
	});
	live.add(deck);
	play(deck);
	return deck;
};

/** Next random track of the same scene, crossfaded over the outgoing one's tail. */
const advance = () => {
	if (!scene) return;
	const out = current;
	current = startTrack(scene, settings.fadeIn);
	if (out) fadeOut(out, settings.fadeOut);
};

/** Restart every current-but-paused track (blocked by autoplay, or paused while backgrounded). */
const resumeDecks = (force = false) =>
	live.forEach((d) => {
		if (d.ending || !d.el.paused || document.hidden) return;
		if (force) void d.el.play().catch(() => {});
		else play(d);
	});

/**
 * Autoplay unlock, on every real gesture until something plays. The element's play() is called
 * synchronously inside the gesture (older iOS Safari has no sticky activation), and the context is
 * resumed alongside: the element can be blocked even when the context already reports "running".
 */
const unlock = () => {
	resumeDecks(true);
	if (ctx && ctx.state !== "running") void ctx.resume().then(() => resumeDecks());
};

/** Call synchronously inside a gesture handler (the lobby's ENTRA) right after `setMusicScene`. */
export const unlockMusic = (): void => unlock();

const init = () => {
	if (initialised || typeof window === "undefined") return;
	initialised = true;
	const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (Ctor) {
		ctx = new Ctor();
		master = ctx.createGain();
		master.gain.value = masterLevel();
		master.connect(ctx.destination);
		// Where autoplay is allowed (Chrome's media engagement for returning visitors, Safari/Firefox
		// "allow autoplay"), this resolves at once and the lobby track starts with no gesture at all.
		// Otherwise it stays pending until the first gesture resumes the context.
		void ctx.resume().then(() => resumeDecks());
	}
	// Mobile/desktop autoplay: the context starts suspended until a real gesture.
	for (const type of ["pointerdown", "keydown", "touchend"] as const) window.addEventListener(type, unlock, { capture: true, passive: true });
	// Backgrounded tab: stop streaming and decoding, pick up where it was on return.
	document.addEventListener("visibilitychange", () => {
		if (document.hidden) {
			live.forEach((d) => d.el.pause());
			void ctx?.suspend();
		} else {
			void (ctx ? ctx.resume() : Promise.resolve()).then(() => resumeDecks());
		}
	});
};

/**
 * Switch the background music to `next` (null = silence). `key` distinguishes sessions of the same
 * scene — a new key picks a new track (e.g. a rematch). Same scene + key is a no-op, so it is safe to
 * call on every render/effect. The outgoing track fades out while the new one fades in.
 */
export const setMusicScene = (next: MusicScene | null, key = ""): void => {
	const id = next ? `${next}:${key}` : null;
	if (id === sceneId) return;
	init();
	sceneId = id;
	scene = next;
	const out = current;
	current = next ? startTrack(next, settings.crossfade) : null;
	if (out) fadeOut(out, settings.crossfade);
};

export const setMusicMuted = (value: boolean): void => {
	settings.muted = value;
	applyLevel();
};

export const setMusicVolume = (value: number): void => {
	settings.volume = Math.max(0, Math.min(1, value));
	applyLevel();
};

export const setMusicFades = (fades: { fadeIn: number; fadeOut: number; crossfade: number }): void => {
	Object.assign(settings, fades);
};

const applyLevel = () => {
	if (master) rampTo(master.gain, masterLevel(), 0.25);
	else live.forEach((d) => (d.el.volume = masterLevel()));
};

// The player's lobby switch fades the music out / back in (the tracks keep running underneath).
soundPref.subscribe(applyLevel);
