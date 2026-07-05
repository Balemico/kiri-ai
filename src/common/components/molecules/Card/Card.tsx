import { MovementCard } from "./MovementCard";
import { RegularCard } from "./RegularCard";
import type { CardDragHandlers } from "../HandCard";
import type { CardView } from "../../../state";
import type { Side } from "../../../game";

export interface CardProps {
	view: CardView;
	/** Whether this card is the currently hovered one (gates movement-card side dimming). */
	active?: boolean;
	/** Touch device: movement-card side preview is driven by taps, not hover. */
	coarse?: boolean;
	/** Touch drag wiring (both card kinds). Regular cards use `onPointerDown`; movement cards `onSideDown`. */
	drag?: CardDragHandlers;
	/** Play a hand card (with a chosen side for movement cards). */
	onPlace?: (side: Side | null) => void;
	/** Return a placed card to hand. */
	onUnplace?: () => void;
}

/** Dispatches a card view to the right renderer (movement vs regular). Hover/lift is handled by the
 * stationary hit zone in HandCard, so card renderers deal only with clicks (and side dimming). */
export const Card = ({ view, active, coarse, drag, onPlace, onUnplace }: CardProps) => {
	if (view.def.kind === "movement") {
		return <MovementCard view={view} active={active} coarse={coarse} drag={drag} onSelectSide={(side) => onPlace?.(side)} onUnplace={onUnplace} />;
	}
	return <RegularCard view={view} drag={drag} onClick={view.location === "hand" ? () => onPlace?.(null) : onUnplace} />;
};
