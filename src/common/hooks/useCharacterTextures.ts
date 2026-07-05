import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import * as THREE from "three";
import type { Stance, Team } from "../game";

/** Resolve the silhouette PNG for a team in a given stance (heaven = sword high, earth = low). */
export const characterImagePath = (team: Team, stance: Stance): string => `/images/characters/${team}-${stance === "heaven" ? "high" : "low"}.png`;

// Preload every team × stance sprite up front, so switching stance (or passing the turn) finds
// the texture already cached and never re-suspends the Battlefield Suspense boundary (which would
// blank it and replay the entrance animation). Preload ONE PATH AT A TIME: useLoader caches under
// a key built from its input, so a single array preload primes a different key than the per-path
// `useLoader(TextureLoader, path)` calls below — they would miss it and suspend on first use.
const CHARACTER_TEXTURE_PATHS = (["red", "blue"] as Team[]).flatMap((team) => (["heaven", "earth"] as Stance[]).map((stance) => characterImagePath(team, stance)));
CHARACTER_TEXTURE_PATHS.forEach((path) => useLoader.preload(TextureLoader, path));

/** Build an unlit, tintable material for a silhouette sprite. Colour-space is set on the map here
 * (param mutation, not the hook return) and the white fill is tinted per-pawn via `material.color`. */
export const makeCharacterMaterial = (texture: THREE.Texture): THREE.MeshBasicMaterial => {
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.needsUpdate = true;
	// depthWrite:false so the two crossfading stance layers blend instead of occluding each other.
	// depthTest:false so the pawn composes purely by renderOrder (PAWN.renderOrder) — above the played
	// cards, below the hand — instead of being covered by the always-on-top (depthTest:false) cards.
	return new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.4, toneMapped: false, depthWrite: false, depthTest: false });
};

/** Load the (shared, cached) silhouette texture for a pawn. */
export const useCharacterTexture = (team: Team, stance: Stance): THREE.Texture => useLoader(TextureLoader, characterImagePath(team, stance));
