import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { leafPose, leafSpawn, type LeafFieldConfig } from "../../../leaves";

const LEAF_URL = "/images/intro/leaf-1.png";
useTexture.preload(LEAF_URL);

const dummy = new THREE.Object3D();

interface LayerProps {
	cfg: LeafFieldConfig;
	indices: number[];
	renderOrder: number;
	opacity: number;
	armedRef: MutableRefObject<boolean>;
}

/**
 * One instanced plane per depth layer; matrices are rewritten every frame from the pure field
 * math. The field runs on its OWN clock, zeroed on the first armed frame: leafPose staggers each
 * leaf's detachment from t=0, so arming starts an empty canopy that sheds leaves one by one —
 * never a screenful of leaves switching on mid-air.
 */
const LeafLayer = ({ cfg, indices, renderOrder, opacity, armedRef }: LayerProps) => {
	const mesh = useRef<THREE.InstancedMesh>(null);
	const start = useRef<number | null>(null);
	const texture = useTexture(LEAF_URL, (loaded) => {
		const tex = Array.isArray(loaded) ? loaded[0] : loaded;
		tex.colorSpace = THREE.SRGBColorSpace;
	});

	useFrame((state) => {
		const m = mesh.current;
		if (!m) return;
		if (!armedRef.current) {
			m.visible = false;
			return;
		}
		start.current ??= state.clock.elapsedTime;
		m.visible = true;
		const t = state.clock.elapsedTime - start.current;
		indices.forEach((leafIndex, i) => {
			const p = leafPose(leafIndex, t, cfg);
			dummy.position.set(p.x, p.y, 0);
			dummy.rotation.set(p.rotX, p.rotY, p.rotZ);
			dummy.scale.setScalar(Math.max(p.scale, 1e-4)); // zero-scale matrices break raycast/frustum math
			dummy.updateMatrix();
			m.setMatrixAt(i, dummy.matrix);
		});
		m.instanceMatrix.needsUpdate = true;
	});

	return (
		<instancedMesh ref={mesh} args={[undefined, undefined, indices.length]} renderOrder={renderOrder} visible={false} frustumCulled={false}>
			<planeGeometry args={[1, 1]} />
			<meshBasicMaterial map={texture} transparent opacity={opacity} alphaTest={0.15} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
		</instancedMesh>
	);
};

export interface FallingLeavesProps {
	cfg: LeafFieldConfig;
	/** Flips true when the choreography releases the leaves — the field clock starts THEN. */
	armedRef: MutableRefObject<boolean>;
}

/**
 * The maple leaves detaching from the lobby tree: GPU-instanced sprites on two depth planes —
 * most in front of the scenery, a pale few behind the mist. All motion comes from `leafPose`
 * (pure, deterministic): leaves detach from the canopy one by one, scale in as they detach, and
 * re-enter from the canopy after each fall.
 */
export const FallingLeaves = ({ cfg, armedRef }: FallingLeavesProps) => {
	// Split the indices once per cfg: `back` is deterministic per index.
	const { front, back } = useMemo(() => {
		const front: number[] = [];
		const back: number[] = [];
		for (let i = 0; i < cfg.count; i++) (leafSpawn(i, cfg).back ? back : front).push(i);
		return { front, back };
	}, [cfg]);

	return (
		<group>
			{back.length > 0 && <LeafLayer cfg={cfg} indices={back} renderOrder={-55} opacity={0.55} armedRef={armedRef} />}
			{front.length > 0 && <LeafLayer cfg={cfg} indices={front} renderOrder={5} opacity={0.95} armedRef={armedRef} />}
		</group>
	);
};
