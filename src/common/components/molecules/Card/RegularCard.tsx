import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { CardModel } from "../../atoms";
import { useCardTextures } from "../../../hooks/useCardTextures";
import { useCardFlip } from "../../../hooks/useCardFlip";
import type { CardDragHandlers } from "../HandCard";
import type { CardView } from "../../../state";

export interface RegularCardProps {
	view: CardView;
	onClick?: () => void;
	/** Touch (coarse): drives selection via drag-and-drop instead of the click; takes over the hit mesh. */
	drag?: CardDragHandlers;
}

// One shared invisible material for every card's hit area (no per-render allocation, no leak).
const HIT_MATERIAL = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });

/** A non-movement card (attacks, specials). Single clickable face. Hover/lift is handled upstream by
 * the stationary hit zone, so this only handles the click (no pointer-over, no stopPropagation churn).
 * On touch, `drag` takes over the hit mesh (browse-select + drag-to-zone); the click is desktop-only. */
export const RegularCard = ({ view, onClick, drag }: RegularCardProps) => {
	const { nodes } = useGLTF("/models/card.glb");
	const { frontMaterial, backMaterial } = useCardTextures(view.team, view.cardId, view.location !== "hand");
	const flipRef = useCardFlip(view.faceUp);

	return (
		<CardModel ref={flipRef} frontMaterial={frontMaterial} backMaterial={backMaterial}>
			{view.interactive &&
				(drag ? (
					<mesh
						position={[0, 0.005, 0]}
						geometry={(nodes.Cube_1 as THREE.Mesh).geometry}
						material={HIT_MATERIAL}
						onPointerDown={drag.onPointerDown}
						onPointerMove={drag.onPointerMove}
						onPointerUp={drag.onPointerUp}
						// A cancelled pointer (OS gesture steal) resolves like a release so a drag never gets stuck.
						onPointerCancel={drag.onPointerUp}
					/>
				) : (
					<mesh
						position={[0, 0.005, 0]}
						geometry={(nodes.Cube_1 as THREE.Mesh).geometry}
						material={HIT_MATERIAL}
						onClick={(e) => {
							e.stopPropagation();
							onClick?.();
						}}
					/>
				))}
		</CardModel>
	);
};
