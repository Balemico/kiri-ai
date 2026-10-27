import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { FLOOR, HORIZON_FRACTION, STAGE_BASE_URL, frameViewport, type Orientation, type SceneFrame } from "../../../layout";
import type { FloorControls } from "../../../hooks/useFloorControls";
import { useThree } from "@react-three/fiber";
import { FLOOR_ALPHA } from "../../../floorTexture";

/**
 * The tilted ground the duel stands on, painted with the same washi-paper plate (0-base) as
 * the backdrop. Fills the lower half of the framed view, its top edge fading into the horizon.
 * The level camera can't see a flat floor, so the plane is raked toward the camera (`tilt`);
 * the height compensates for the foreshortening so the projected band still fills the screen.
 * Sits in front of the background panels and behind the pieces. The "Floor" Leva controls are
 * lifted to the parent (`useFloorControls`) so the battleground can rake onto the same tilt.
 */
export const Floor = ({
	frame,
	controls,
	orientation = "landscape",
	// Where the floor's top edge meets the scenery — the duel keeps the shared default; the lobby
	// passes its own, deeper horizon (LOBBY.horizonFraction) for a shorter bare-paper band.
	horizonFraction = HORIZON_FRACTION,
	// World y of the floor's near (bottom) edge. Defaults to the frame's bottom; the lobby passes the
	// VISIBLE bottom, which on a tall portrait screen lies well below the frame.
	bottomY,
}: {
	frame: SceneFrame;
	controls: FloorControls;
	orientation?: Orientation;
	horizonFraction?: number;
	bottomY?: number;
}) => {
	const c = controls;

	const paper = useTexture(STAGE_BASE_URL, (loaded) => {
		const tex = Array.isArray(loaded) ? loaded[0] : loaded;
		tex.colorSpace = THREE.SRGBColorSpace;
	});

	const size = useThree((s) => s.size);
	// Landscape: the floor fills the lower half, its top edge meeting the horizon. Portrait: the
	// background is gone, so the floor fills the WHOLE frame (band = full height) and covers the full
	// visible width — the tilt/perspective is preserved, the far (top) edge still fading into paper.
	const portrait = orientation === "portrait";
	const horizonY = frame.top - (frame.top - frame.bottom) * horizonFraction;
	const topEdge = portrait ? frame.top : horizonY;
	const bottom = Math.min(bottomY ?? frame.bottom, frame.bottom);
	const band = topEdge - bottom;
	// Compensate the tilt foreshortening so the projected height still spans the band.
	const height = (band / Math.cos(c.tilt)) * FLOOR.overscan;
	const centerY = (topEdge + bottom) / 2 + c.yNudge;
	const width = portrait ? frameViewport(frame, size.width / size.height).width * c.widthScale : frame.halfWidth * 2 * c.widthScale;

	return (
		<mesh position={[0, centerY, c.z]} rotation={[-c.tilt, 0, 0]} renderOrder={-10}>
			<planeGeometry args={[width, height]} />
			<meshBasicMaterial
				map={paper}
				alphaMap={FLOOR_ALPHA}
				color={new THREE.Color(c.tint, c.tint, c.tint)}
				transparent
				opacity={c.opacity}
				side={THREE.DoubleSide}
				toneMapped={false}
				depthWrite={false}
			/>
		</mesh>
	);
};
