import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Line } from "@react-three/drei";
import { gsap } from "gsap";
import * as THREE from "three";
import type { Line2 } from "three-stdlib";

export interface LandingZoneProps {
	/** Card footprint at this spot (world units) — the outline matches the real card size + shape. */
	width: number;
	height: number;
	color: string;
	outlineOpacity: number;
	fillOpacity: number;
	/** Dash thickness in screen px. */
	lineWidth: number;
	/** Dash + gap lengths (world units along the outline). */
	dash: number;
	gap: number;
	cornerRadius: number;
	/** Japanese numeral painted centred in the zone (omitted for the set-aside spot). */
	label?: string;
	/** Numeral height in WORLD units (drawn as a WebGL plane so a dragged/landed card can cover it —
	 *  an HTML overlay always sits above the canvas and would poke through the card). */
	labelWorldSize?: number;
	labelOpacity?: number;
	/** Whether the spot is currently EMPTY (the zone is shown). Toggling fades the whole zone in/out
	 *  rather than mounting/unmounting it, so it never pops when a card lands on (or leaves) the spot. */
	active?: boolean;
	/** Cross-fade duration when `active` flips. */
	fadeSeconds?: number;
	/** Draw order — kept under the cards (which render at 100+) so a landed card covers the zone. */
	renderOrder?: number;
}

/** Closed rounded-rectangle outline (world units), traced corner-arc by corner-arc. */
const roundedRectPoints = (w: number, h: number, radius: number, seg = 6): [number, number, number][] => {
	const hw = w / 2;
	const hh = h / 2;
	const r = Math.max(0, Math.min(radius, hw, hh));
	const corners = [
		{ cx: hw - r, cy: hh - r, start: 0 }, // top-right
		{ cx: -hw + r, cy: hh - r, start: Math.PI / 2 }, // top-left
		{ cx: -hw + r, cy: -hh + r, start: Math.PI }, // bottom-left
		{ cx: hw - r, cy: -hh + r, start: 1.5 * Math.PI }, // bottom-right
	];
	const pts: [number, number, number][] = [];
	for (const c of corners) {
		for (let i = 0; i <= seg; i++) {
			const a = c.start + (i / seg) * (Math.PI / 2);
			pts.push([c.cx + r * Math.cos(a), c.cy + r * Math.sin(a), 0]);
		}
	}
	pts.push(pts[0]); // close the loop so the dashes wrap continuously
	return pts;
};

/** Rounded-rectangle fill geometry (matches the outline silhouette). */
const roundedRectGeometry = (w: number, h: number, radius: number): THREE.ShapeGeometry => {
	const hw = w / 2;
	const hh = h / 2;
	const r = Math.max(0, Math.min(radius, hw, hh));
	const shape = new THREE.Shape();
	shape.moveTo(-hw + r, -hh);
	shape.lineTo(hw - r, -hh);
	shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
	shape.lineTo(hw, hh - r);
	shape.quadraticCurveTo(hw, hh, hw - r, hh);
	shape.lineTo(-hw + r, hh);
	shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
	shape.lineTo(-hw, -hh + r);
	shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
	return new THREE.ShapeGeometry(shape);
};

/**
 * A single landing-zone placeholder: a dashed, semi-transparent rounded outline the exact size and
 * shape of a card, a faint tint inside, and an optional centred Japanese numeral. Placed by its
 * parent (the LandingZones section); everything here is centred on the local origin. The meshes
 * ignore depth and draw with a low renderOrder so a card that lands on the spot paints over them
 * (cards are the always-on-top layer at renderOrder 100+).
 *
 * Visibility is driven by `active` (the spot is empty) and CROSS-FADED — opacity is owned here by gsap
 * (the line/fill materials) and motion (the numeral), so it never mounts/unmounts; a card landing or
 * leaving its spot fades the guide out/in smoothly instead of popping.
 */
export const LandingZone = ({
	width,
	height,
	color,
	outlineOpacity,
	fillOpacity,
	lineWidth,
	dash,
	gap,
	cornerRadius,
	label,
	labelWorldSize = height * 0.24,
	labelOpacity = 1,
	active = true,
	fadeSeconds = 0.45,
	renderOrder = 80,
}: LandingZoneProps) => {
	const points = useMemo(() => roundedRectPoints(width, height, cornerRadius), [width, height, cornerRadius]);
	const fillGeo = useMemo(() => roundedRectGeometry(width, height, cornerRadius), [width, height, cornerRadius]);
	useEffect(() => () => fillGeo.dispose(), [fillGeo]);

	// The numeral as a WebGL texture (white glyph on transparent, tinted by the material's `color`), so it
	// draws in the canvas — under the cards — instead of as an HTML overlay that would float above them.
	// Kanji resolve through the browser's system CJK fallback, so no bespoke font file is needed.
	const labelTexture = useMemo(() => {
		if (!label) return null;
		const px = 256;
		const canvas = document.createElement("canvas");
		canvas.width = px;
		canvas.height = px;
		const ctx = canvas.getContext("2d");
		if (!ctx) return null;
		ctx.fillStyle = "#ffffff";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.font = `700 ${px * 0.8}px "Hirokawa", system-ui, sans-serif`;
		ctx.fillText(label, px / 2, px / 2);
		const tex = new THREE.CanvasTexture(canvas);
		tex.colorSpace = THREE.SRGBColorSpace;
		return tex;
	}, [label]);
	useEffect(() => () => labelTexture?.dispose(), [labelTexture]);

	const lineRef = useRef<Line2>(null);
	const fillRef = useRef<THREE.Mesh>(null);
	const labelRef = useRef<THREE.Mesh>(null);
	const initialized = useRef(false);

	// Opacity is NOT passed as a (React-controlled) prop — it would be reset on every render and fight
	// the tween. Instead gsap owns the materials' opacity: snapped on first mount, faded on `active`/
	// opacity changes. The numeral fades on the same tween, in lockstep with the outline/fill.
	const outlineTarget = active ? outlineOpacity : 0;
	const fillTarget = active ? fillOpacity : 0;
	const labelTarget = active ? labelOpacity : 0;
	useLayoutEffect(() => {
		const lineMat = lineRef.current?.material as THREE.Material | undefined;
		const fillMat = fillRef.current?.material as THREE.Material | undefined;
		const labelMat = labelRef.current?.material as THREE.Material | undefined;
		const duration = initialized.current ? fadeSeconds : 0; // snap on mount, fade on later flips
		initialized.current = true;
		if (lineMat) gsap.to(lineMat, { opacity: outlineTarget, duration, ease: "power2.out", overwrite: true });
		if (fillMat) gsap.to(fillMat, { opacity: fillTarget, duration, ease: "power2.out", overwrite: true });
		if (labelMat) gsap.to(labelMat, { opacity: labelTarget, duration, ease: "power2.out", overwrite: true });
	}, [outlineTarget, fillTarget, labelTarget, fadeSeconds]);

	return (
		<group>
			<mesh ref={fillRef} geometry={fillGeo} renderOrder={renderOrder - 1}>
				<meshBasicMaterial color={color} transparent depthTest={false} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
			</mesh>
			<Line
				ref={lineRef}
				points={points}
				color={color}
				lineWidth={lineWidth}
				dashed
				dashSize={dash}
				gapSize={gap}
				transparent
				depthTest={false}
				depthWrite={false}
				toneMapped={false}
				renderOrder={renderOrder}
			/>
			{label && labelTexture && (
				<mesh ref={labelRef} position={[0, 0, 0.002]} renderOrder={renderOrder}>
					<planeGeometry args={[labelWorldSize, labelWorldSize]} />
					<meshBasicMaterial map={labelTexture} color={color} transparent depthTest={false} depthWrite={false} toneMapped={false} />
				</mesh>
			)}
		</group>
	);
};
