import type { CSSProperties, ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { WebGPURenderer } from "three/webgpu";

export interface InkCanvasProps {
	children: ReactNode;
	style?: CSSProperties;
	/** Device-pixel-ratio cap: the ink is a full-screen fragment shader, keep the fill cost bounded. */
	maxDpr?: number;
	/** Fixed DPR (overrides `maxDpr`), e.g. below 1 for a soft full-screen effect. */
	dpr?: number;
	/** "demand" parks an idle canvas (no frames until invalidated); "always" while animating. */
	frameloop?: "always" | "demand";
}

/**
 * A transparent, click-through R3F canvas for the TSL ink, rendered by `WebGPURenderer` (WebGPU,
 * or its WebGL2 backend where WebGPU is missing — TSL compiles to both). The camera is
 * orthographic at zoom 1, so ONE WORLD UNIT IS ONE CSS PIXEL, origin at the canvas centre, y up.
 * The game/lobby scenes keep their own WebGL canvases; only the ink lives here.
 */
export const InkCanvas = ({ children, style, maxDpr = 2, dpr, frameloop = "always" }: InkCanvasProps) => (
	<Canvas
		orthographic
		flat
		frameloop={frameloop}
		dpr={dpr ?? [1, maxDpr]}
		camera={{ position: [0, 0, 100], zoom: 1, near: 0.1, far: 1000 }}
		gl={async ({ canvas }) => {
			const renderer = new WebGPURenderer({ canvas: canvas as HTMLCanvasElement, alpha: true, antialias: true });
			await renderer.init();
			renderer.setClearColor(0x000000, 0);
			return renderer;
		}}
		style={{ position: "fixed", inset: 0, pointerEvents: "none", ...style }}
	>
		{children}
	</Canvas>
);
