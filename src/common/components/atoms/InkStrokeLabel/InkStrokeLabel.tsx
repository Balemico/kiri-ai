import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { inkStrokes, INK_TONE_FALLBACK, inkSupported, newInkStrokeId, type InkTone } from "../../../ink/inkRegistry";

export interface InkStrokeLabelProps {
	children: ReactNode;
	tone: InkTone;
	/** Which brush (also seeds the stroke's shape). */
	variant?: 0 | 1 | 2;
	/** Seconds to wait before the stroke is laid. */
	delay?: number;
	style?: CSSProperties;
	/** One stroke split down the middle, each half in its own tone (overrides `tone`'s colour). */
	split?: { left: InkTone; right: InkTone };
}

/**
 * A non-interactive caption painted on a sumi stroke — the same ink as `InkStrokeButton`: it only
 * REGISTERS its box in `ink/inkRegistry`, and the scene's `InkLayer` lays the stroke under it
 * (tracking the box + its effective opacity every frame). The text stays DOM, on top.
 */
export const InkStrokeLabel = ({ children, tone, variant = 0, delay = 0, style, split }: InkStrokeLabelProps) => {
	const ref = useRef<HTMLSpanElement>(null);
	const [id] = useState(newInkStrokeId);
	const ink = inkSupported();
	// Primitives, so a fresh `split` object each render doesn't re-register the stroke.
	const splitLeft = split?.left;
	const splitRight = split?.right;

	useEffect(() => {
		if (!ink || !ref.current) return;
		const segment = splitLeft && splitRight ? { left: splitLeft, right: splitRight, active: 0 as const, both: true } : undefined;
		inkStrokes.upsert({ id, el: ref.current, tone, variant, visible: true, hovered: false, disabled: false, delay, leaving: false, exitDelay: 0, segment });
	}, [ink, id, tone, variant, delay, splitLeft, splitRight]);
	useEffect(() => () => inkStrokes.remove(id), [id]);

	return (
		<span
			ref={ref}
			style={{
				display: "inline-block",
				padding: "0.45em 1.4em",
				color: "#f2ead9",
				// No ink canvas → a flat CSS brush-ish stand-in.
				background: ink ? undefined : split ? `linear-gradient(90deg, ${INK_TONE_FALLBACK[split.left]} 50%, ${INK_TONE_FALLBACK[split.right]} 50%)` : INK_TONE_FALLBACK[tone],
				borderRadius: ink ? undefined : "40% 12% 30% 10% / 50% 20% 50% 20%",
				...style,
			}}
		>
			{children}
		</span>
	);
};
