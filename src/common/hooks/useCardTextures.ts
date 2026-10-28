import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import * as THREE from "three";
import { useEffect, useMemo } from "react";
import type { CardId, Team } from "../game";
import { CARD_DEFS } from "../game/cards";
import { CARD_ALPHA_MAP } from "../cardAlpha";

const BACK_PATH = "/images/cards/back/card-back.svg";

/** Resolve the SVG texture path for a card front. */
export const cardImagePath = (team: Team, cardId: CardId): string => {
	if (cardId.startsWith("special-")) return `/images/cards/special/${cardId}.svg`;
	return `/images/cards/${team}/${team}-${cardId}.svg`;
};

// Preload every card face (both teams) + the back up front, so passing the turn to the other
// player finds the textures already cached and never re-suspends (which would blank the scene).
// Preload ONE PATH AT A TIME: useLoader keys its cache on its input, so a single array preload
// primes a different key than the per-path `useLoader(TextureLoader, path)` calls below would miss.
const CARD_TEXTURE_PATHS = [...new Set([BACK_PATH, ...(["red", "blue"] as Team[]).flatMap((team) => CARD_DEFS.map((def) => cardImagePath(team, def.id)))])];
CARD_TEXTURE_PATHS.forEach((path) => useLoader.preload(TextureLoader, path));

// Every card is unlit: at the angles a card is seen on a phone (a lifted hand card low on the screen, the
// portrait columns turned about Y by `playedTilt`) a glossy standard face mirrors the bright HDRI sky and
// washes the art out. Unlit keeps the painted colours exact at any angle, like the scenery — and one
// material kind means nothing is rebuilt when a card moves between hand and slot.
const makeMaterial = (texture: THREE.Texture, flipY = false): THREE.Material => {
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.flipY = flipY;
	texture.needsUpdate = true;
	return new THREE.MeshBasicMaterial({
		map: texture,
		toneMapped: false,
		alphaMap: CARD_ALPHA_MAP, // rounded-corner cutout
		alphaTest: 0.5, // hard cutout → no transparency sorting between overlapping cards
		// Cards are the topmost UI and must draw over the scenery, floor AND pawns regardless of z.
		// Bake it into the material (don't rely only on HandCard's traverse effect, which can miss a
		// mesh that mounts after it runs): ignore + don't write depth, and draw in the topmost pass.
		transparent: true,
		depthTest: false,
		depthWrite: false,
	});
};

/** Load front (card art) and back materials for a card. */
export const useCardTextures = (team: Team, cardId: CardId) => {
	const frontPath = cardImagePath(team, cardId);
	const frontTexture = useLoader(TextureLoader, frontPath);
	const backTexture = useLoader(TextureLoader, BACK_PATH);

	const frontMaterial = useMemo(() => makeMaterial(frontTexture, false), [frontTexture]);
	const backMaterial = useMemo(() => makeMaterial(backTexture, true), [backTexture]);

	// Free the per-card materials when the card unmounts or the material changes
	// (the shared textures stay cached by useLoader and are not disposed here).
	useEffect(() => () => frontMaterial.dispose(), [frontMaterial]);
	useEffect(() => () => backMaterial.dispose(), [backMaterial]);

	return { frontMaterial, backMaterial };
};
