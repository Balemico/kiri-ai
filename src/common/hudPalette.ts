import type { Stance, Team } from "./game";

// The HUD speaks the same sumi-e language as the lobby: paper, ink and one vermilion accent.
export const INK = "#17120e";
export const PAPER_LIGHT = "#f2ead9";
/** Classic vermilion of a hanko (name seal). */
export const SEAL = "#b73225";

/** Team colours — match the pawns and the card-name reveal. */
export const TEAM_INK: Record<Team, string> = { red: "#d8303d", blue: "#579cb1" };
export const TEAM_NAME: Record<Team, string> = { red: "ROSSO", blue: "BLU" };
/** 赤 (aka, red) / 青 (ao, blue) — the traditional kendo match colours. */
export const TEAM_KANJI: Record<Team, string> = { red: "赤", blue: "青" };

export const STANCE_LABEL: Record<Stance, { kanji: string; label: string }> = {
	heaven: { kanji: "天", label: "CIELO" },
	earth: { kanji: "地", label: "TERRA" },
};

const DIGITS = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

/** 1 → 一, 10 → 十, 12 → 十二, 21 → 二十一 … up to 99; beyond that, plain digits. */
export const kanjiNumeral = (n: number): string => {
	if (!Number.isInteger(n) || n < 1 || n > 99) return String(n);
	const tens = Math.floor(n / 10);
	const ones = n % 10;
	const tensPart = tens === 0 ? "" : `${tens === 1 ? "" : DIGITS[tens]}十`;
	return tensPart + DIGITS[ones];
};
