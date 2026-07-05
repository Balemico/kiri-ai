import type { CardDef, CardId, CardEffect, Side } from "./types";

/**
 * Card definitions. Ids are kept stable because the SVG textures are resolved
 * from them: `/images/cards/<team>/<team>-<id>.svg` (normal) or
 * `/images/cards/special/<id>.svg` (special).
 *
 * Movement cards expose two faces ([0] = top, [1] = bottom); attack cards a single one.
 */
export const CARD_DEFS: CardDef[] = [
	// --- Movement ---
	{
		id: "card-approach",
		kind: "movement",
		faces: [
			{ kind: "movement", amount: 1 }, // top: Approach
			{ kind: "movement", amount: -1 }, // bottom: Retreat
		],
	},
	{
		id: "card-charge",
		kind: "movement",
		faces: [
			{ kind: "movement", amount: 2 }, // top: Charge
			{ kind: "change-stance" }, // bottom: Change Stance
		],
	},
	// --- Attacks ---
	{
		id: "card-balance-strike",
		kind: "attack",
		faces: [{ kind: "attack", stance: ["heaven", "earth"], distance: [0] }],
	},
	{
		id: "card-high-strike",
		kind: "attack",
		faces: [{ kind: "attack", stance: ["heaven"], distance: [2] }],
	},
	{
		id: "card-low-strike",
		kind: "attack",
		faces: [{ kind: "attack", stance: ["earth"], distance: [1] }],
	},
	// --- Special attacks (used once, then discarded) ---
	{
		id: "special-counter",
		kind: "attack",
		special: true,
		faces: [{ kind: "counter", stance: ["heaven", "earth"] }],
	},
	{
		id: "special-kesa",
		kind: "attack",
		special: true,
		faces: [{ kind: "attack", stance: ["heaven"], distance: [0, 1], switchStanceTo: "earth" }],
	},
	{
		id: "special-zantetsu",
		kind: "attack",
		special: true,
		faces: [{ kind: "attack", stance: ["earth"], distance: [2, 3], switchStanceTo: "heaven" }],
	},
];

const DEFS_BY_ID = new Map(CARD_DEFS.map((c) => [c.id, c]));

export const NORMAL_CARDS = CARD_DEFS.filter((c) => !c.special);
export const SPECIAL_CARDS = CARD_DEFS.filter((c) => c.special);

export const getCardDef = (cardId: CardId): CardDef | undefined => DEFS_BY_ID.get(cardId);

export const isSpecial = (cardId: CardId): boolean => !!getCardDef(cardId)?.special;

/** A card face's name in English plus its Japanese name (kanji) and romaji transliteration. */
export interface CardLabel {
	en: string;
	/** Japanese name in kanji. */
	ja: string;
	/** Romaji transliteration of the Japanese name. */
	romaji: string;
}

/** Label of each card face. Movement cards differ by side ([top, bottom]). */
const CARD_LABELS: Record<CardId, CardLabel | [CardLabel, CardLabel]> = {
	"card-approach": [
		{ en: "Approach", ja: "近寄", romaji: "Chika-yori" },
		{ en: "Retreat", ja: "遠退", romaji: "Tō-noki" },
	],
	"card-charge": [
		{ en: "Charge", ja: "飛掛", romaji: "Tobi-gake" },
		{ en: "Change Stance", ja: "構変", romaji: "Kamae-hen" },
	],
	"card-balance-strike": { en: "Balance Strike", ja: "水平", romaji: "Sui-hei" },
	"card-high-strike": { en: "High Strike", ja: "唐竹", romaji: "Kara-take" },
	"card-low-strike": { en: "Low Strike", ja: "斬上", romaji: "Zan-jō" },
	"special-counter": { en: "Counter", ja: "返斬", romaji: "Kaeshi-giri" },
	"special-kesa": { en: "Kesa-Giri", ja: "袈裟", romaji: "Ke-sa" },
	"special-zantetsu": { en: "Zan-Tetsu", ja: "斬鉄", romaji: "Zan-Tetsu" },
};

/** Full label (English + Japanese + romaji) of a placed card, accounting for the chosen movement face. */
export const getCardLabel = (cardId: CardId, side: Side | null): CardLabel | undefined => {
	const label = CARD_LABELS[cardId];
	if (!label) return undefined;
	if (!Array.isArray(label)) return label;
	return side === "bottom" ? label[1] : label[0];
};

/** Display name (English) of a placed card, accounting for the chosen face of movement cards. */
export const getCardName = (cardId: CardId, side: Side | null): string => getCardLabel(cardId, side)?.en ?? cardId;

/**
 * Resolve the effect produced by a placed card given the chosen side.
 * Movement cards: top → face[0], bottom → face[1].
 * Attack cards: the single face regardless of side.
 */
export const getEffect = (cardId: CardId, side: Side | null): CardEffect | undefined => {
	const def = getCardDef(cardId);
	if (!def) return undefined;
	if (def.kind === "attack") return def.faces[0];
	const index = side === "bottom" ? 1 : 0;
	return def.faces[index];
};

/**
 * Randomly deal one special card to each player; the third is left out.
 * @returns the special CardId assigned to red and blue.
 */
export const distributeSpecials = (): { red: CardId; blue: CardId } => {
	const shuffled = [...SPECIAL_CARDS].sort(() => Math.random() - 0.5);
	return { red: shuffled[0].id, blue: shuffled[1].id };
};
