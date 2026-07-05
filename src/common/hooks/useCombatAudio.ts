import { useEffect, useRef } from "react";
import { useGame } from "../state";
import type { ActionResolution } from "../game";
import { playSound, preloadSounds, unlockAudio } from "../audio";

/** Movement resolves before attacks, so let the footstep land first, then the strike/clash. */
const STRIKE_DELAY_MS = 260;

/** Fire the sounds for one resolved action (mirrors the rules' movement→attack ordering). */
const playForResolution = (res: ActionResolution): (() => void) | undefined => {
	const moved = res.red.moved || res.blue.moved;
	if (moved) playSound("steps");

	const strike = () => {
		if (res.clash) {
			playSound("clash"); // both blades meet — a parry
			return;
		}
		if (res.red.hit || res.blue.hit) playSound("slash"); // a strike landed
		if (res.red.feint || res.blue.feint) playSound("miss"); // an attack whiffed
	};

	const hasStrike = res.clash || res.red.hit || res.blue.hit || res.red.feint || res.blue.feint;
	if (!hasStrike) return undefined;
	if (!moved) {
		strike();
		return undefined;
	}
	const timer = window.setTimeout(strike, STRIKE_DELAY_MS);
	return () => window.clearTimeout(timer);
};

/** Watches the last resolved action and plays the matching combat sounds exactly once per action. */
export const useCombatAudio = (): void => {
	const { state } = useGame();
	const res = state.lastResolution;
	const playedKey = useRef<string | null>(null);

	useEffect(() => {
		preloadSounds();
		// Unlock audio on the first user gesture (mobile autoplay policy) — once, then self-removes.
		const onFirstGesture = () => unlockAudio();
		window.addEventListener("pointerdown", onFirstGesture, { once: true });
		return () => window.removeEventListener("pointerdown", onFirstGesture);
	}, []);

	useEffect(() => {
		if (!res) {
			playedKey.current = null; // round ended / reset — re-arm for the next action
			return;
		}
		const key = `${state.round}-${res.slot}`;
		if (playedKey.current === key) return;
		playedKey.current = key;
		return playForResolution(res);
	}, [res, state.round]);
};
