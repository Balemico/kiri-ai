import { useMemo, useRef } from "react";
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
}

/** One instanced plane per depth layer; matrices are rewritten every frame from the pure field math. */
const LeafLayer = ({ cfg, indices, renderOrder, opacity }: LayerProps) => {
	const mesh = useRef<THREE.InstancedMesh>(null);
	const texture = useTexture(LEAF_URL, (loaded) => {
		const tex = Array.isArray(loaded) ? loaded[0] : loaded;
		tex.colorSpace = THREE.SRGBColorSpace;
	});

	useFrame((state) => {
		const m = mesh.current;
		if (!m) return;
		indices.forEach((leafIndex, i) => {
			const p = leafPose(leafIndex, state.clock.elapsedTime, cfg);
			dummy.position.set(p.x, p.y, 0);
			dummy.rotation.set(p.rotX, p.rotY, p.rotZ);
			dummy.scale.setScalar(p.scale);
			dummy.updateMatrix();
			m.setMatrixAt(i, dummy.matrix);
		});
		m.instanceMatrix.needsUpdate = true;
	});

	return (
		<instancedMesh ref={mesh} args={[undefined, undefined, indices.length]} renderOrder={renderOrder} frustumCulled={false}>
			<planeGeometry args={[1, 1]} />
			<meshBasicMaterial map={texture} transparent opacity={opacity} alphaTest={0.15} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
		</instancedMesh>
	);
};

export interface FallingLeavesProps {
	cfg: LeafFieldConfig;
	visible?: boolean;
}

/**
 * The maple leaves detaching from the lobby tree: GPU-instanced sprites on two depth planes —
 * most in front of the scenery, a pale few behind the mist. All motion comes from `leafPose`
 * (pure, deterministic), so the field never pops or respawns mid-air.
 */
export const FallingLeaves = ({ cfg, visible = true }: FallingLeavesProps) => {
	// Split the indices once per cfg: `back` is deterministic per index.
	const { front, back } = useMemo(() => {
		const front: number[] = [];
		const back: number[] = [];
		for (let i = 0; i < cfg.count; i++) (leafSpawn(i, cfg).back ? back : front).push(i);
		return { front, back };
	}, [cfg]);

	return (
		<group visible={visible}>
			{back.length > 0 && <LeafLayer cfg={cfg} indices={back} renderOrder={-55} opacity={0.55} />}
			{front.length > 0 && <LeafLayer cfg={cfg} indices={front} renderOrder={5} opacity={0.95} />}
		</group>
	);
};
