import * as THREE from "three";

/**
 * The sword cut on a struck paper samurai: a thin TRIANGULAR notch cut out of the sheet — wide where
 * the blade entered, tapering to a point inside the figure — like the cut silhouettes on the cards.
 * The pieces don't move; the notch just shows the paper behind.
 *
 * No extra meshes: each paper layer (edge, rim, silhouette — both stances) keeps its single plane and
 * its fragment shader clears the wedge. All cut geometry lives in FIGURE space = the stance group's
 * space (pre-mirror; body column at x = 0, feet at y ≈ 0), so one wedge runs through every layer and
 * both poses alike. Each layer maps its own plane into that space (`layerScale`, `layerOffset` = the
 * mesh's scale / position). The silhouette's wedge is a touch wider than the rim's, so a line of white
 * paper rim edges the cut.
 */
export interface CutUniforms {
	/** 0 = whole figure, 1 = cut. */
	on: { value: number };
	/** The wedge's axis: a point on it and its unit direction (base → tip), figure space. */
	point: { value: THREE.Vector2 };
	dir: { value: THREE.Vector2 };
	/** Where the base sits along the axis (from `point`), and the wedge's current length / half-width at
	 *  the base — this layer's own (already scaled by the cut's animation). */
	start: { value: number };
	length: { value: number };
	halfWidth: { value: number };
	/** This layer's plane → figure space: fig = position.xy · layerScale + layerOffset. */
	layerScale: { value: THREE.Vector2 };
	layerOffset: { value: THREE.Vector2 };
}

const makeCutUniforms = (): CutUniforms => ({
	on: { value: 0 },
	point: { value: new THREE.Vector2() },
	dir: { value: new THREE.Vector2(1, 0) },
	start: { value: 0 },
	length: { value: 1 },
	halfWidth: { value: 0 },
	layerScale: { value: new THREE.Vector2(1, 1) },
	layerOffset: { value: new THREE.Vector2() },
});

/** Patch a character material (MeshBasicMaterial with a `map`) so it draws the cut. The uniforms are
 *  stashed on `userData.cut` for frame-loop updates. */
export const withCut = (material: THREE.MeshBasicMaterial): THREE.MeshBasicMaterial => {
	const u = makeCutUniforms();
	material.userData.cut = u;
	material.onBeforeCompile = (shader) => {
		shader.uniforms.uCutOn = u.on;
		shader.uniforms.uCutPoint = u.point;
		shader.uniforms.uCutDir = u.dir;
		shader.uniforms.uCutStart = u.start;
		shader.uniforms.uCutLength = u.length;
		shader.uniforms.uCutHalfWidth = u.halfWidth;
		shader.uniforms.uLayerScale = u.layerScale;
		shader.uniforms.uLayerOffset = u.layerOffset;
		shader.vertexShader =
			"uniform vec2 uLayerScale;\nuniform vec2 uLayerOffset;\nvarying vec2 vFig;\n" +
			shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvFig = position.xy * uLayerScale + uLayerOffset;");
		shader.fragmentShader =
			"uniform float uCutOn;\nuniform vec2 uCutPoint;\nuniform vec2 uCutDir;\nuniform float uCutStart;\nuniform float uCutLength;\nuniform float uCutHalfWidth;\nvarying vec2 vFig;\n" +
			shader.fragmentShader.replace(
				"#include <map_fragment>",
				/* glsl */ `
				#ifdef USE_MAP
					vec4 sampledDiffuseColor = texture2D( map, vMapUv );
					if ( uCutOn > 0.5 ) {
						vec2 d = vFig - uCutPoint;
						// 0 at the base → 1 at the tip; the half-width tapers linearly to a point.
						float t = ( dot( d, uCutDir ) - uCutStart ) / max( uCutLength, 1e-4 );
						float across = abs( dot( d, vec2( -uCutDir.y, uCutDir.x ) ) );
						if ( t >= 0.0 && t <= 1.0 && across < uCutHalfWidth * ( 1.0 - t ) ) sampledDiffuseColor.a = 0.0;
					}
					diffuseColor *= sampledDiffuseColor;
				#endif
				`,
			);
	};
	return material;
};

/** The cut uniforms of a patched material (see `withCut`). */
export const cutOf = (material: unknown): CutUniforms | undefined => (material as THREE.Material | undefined)?.userData?.cut as CutUniforms | undefined;

/** Sync a layer's plane → figure-space mapping from its mesh (position / scale). */
export const syncCutLayer = (mesh: THREE.Mesh) => {
	const u = cutOf(mesh.material);
	if (!u) return;
	u.layerScale.value.set(mesh.scale.x, mesh.scale.y);
	u.layerOffset.value.set(mesh.position.x, mesh.position.y);
};
