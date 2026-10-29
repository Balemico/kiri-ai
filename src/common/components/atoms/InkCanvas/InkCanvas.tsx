import { useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrthographicCamera, Vector2 } from "three";
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

const drawn = new Vector2();

/**
 * ONE renderer per canvas. R3F's <Canvas> calls `root.configure()` on EVERY render, and configure only
 * checks "no renderer yet?" BEFORE awaiting our async factory — so a re-render during
 * WebGPURenderer's init started a SECOND renderer on the same canvas (that loser is where the old
 * "depth stencil attachment 300×150" errors came from). Overlapping calls now share one init.
 */
const renderers = new WeakMap<HTMLCanvasElement, Promise<WebGPURenderer>>();
const createRenderer = (canvas: HTMLCanvasElement): Promise<WebGPURenderer> => {
	let pending = renderers.get(canvas);
	if (!pending) {
		// NO depth/stencil buffer: the ink is flat transparent quads drawn in order (its materials never
		// depth-test) — nothing to size, nothing to fail validation.
		const renderer = new WebGPURenderer({ canvas, alpha: true, antialias: true, depth: false, stencil: false });
		pending = renderer.init().then(() => {
			renderer.setClearColor(0x000000, 0);
			return renderer;
		});
		renderers.set(canvas, pending);
	}
	return pending;
};

/**
 * Enforces the requested frameloop once the renderer is up — and again whenever something else sets
 * it. The same configure race: each overlapping call compares the prop with a store snapshot taken
 * BEFORE its await, so a stale call could leave the canvas parked on "demand" after InkLayer asked
 * for "always" (it starts on "demand" until its first button registers). Parked, it drew no stroke
 * until a window resize forced a frame: the buttons "didn't come".
 */
const FrameloopSync = ({ frameloop }: { frameloop: "always" | "demand" }) => {
	const current = useThree((s) => s.frameloop);
	const setFrameloop = useThree((s) => s.setFrameloop);
	const invalidate = useThree((s) => s.invalidate);
	useEffect(() => {
		if (current !== frameloop) setFrameloop(frameloop);
		else invalidate(); // a parked canvas still paints its current state once
	}, [current, frameloop, setFrameloop, invalidate]);
	return null;
};

/**
 * Keeps renderer AND camera matched to the canvas's real size. R3F re-fits both only when its stored
 * size CHANGES — and the configure race (see `createRenderer`) breaks that: each overlapping
 * configure() works from a store snapshot taken before its await, so a late one created a NEW camera
 * after the size was already stored. That camera never got its frustum (left = right = 0): the ink
 * canvas ran, sized right, and showed NOTHING — the buttons' cream labels vanished on the paper until
 * a window resize changed the size and R3F finally re-fitted it. (Reproduced by slowing the
 * renderer's init.) Each frame: store ← container, camera ← store, renderer ← store; a few
 * comparisons, and nothing happens once they agree.
 */
const SizeSync = () => {
	useFrame((state) => {
		const { gl, size, viewport, camera } = state;
		// The container (R3F's wrapper div), not the canvas: R3F writes its stored size into the
		// canvas's own style, so a stale size would look "right" there.
		const box = gl.domElement.parentElement;
		const w = box?.clientWidth ?? 0;
		const h = box?.clientHeight ?? 0;
		if (w > 0 && h > 0 && (w !== size.width || h !== size.height)) {
			state.setSize(w, h);
			return;
		}
		// The orthographic frustum, exactly as R3F's own updateCamera fits it: 1 unit = 1 CSS px.
		if (camera instanceof OrthographicCamera && (camera.right !== size.width / 2 || camera.top !== size.height / 2)) {
			camera.left = size.width / -2;
			camera.right = size.width / 2;
			camera.top = size.height / 2;
			camera.bottom = size.height / -2;
			camera.updateProjectionMatrix();
		}
		// Both the renderer's own idea of its size and the canvas's actual buffer (three sizes it to
		// floor(css × ratio)) — whichever went stale, it's re-applied.
		gl.getSize(drawn);
		const canvas = gl.domElement;
		const stale =
			drawn.x !== size.width ||
			drawn.y !== size.height ||
			gl.getPixelRatio() !== viewport.dpr ||
			canvas.width !== Math.floor(size.width * viewport.dpr) ||
			canvas.height !== Math.floor(size.height * viewport.dpr);
		if (stale) {
			gl.setPixelRatio(viewport.dpr);
			gl.setSize(size.width, size.height);
		}
	});
	return null;
};

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
		gl={({ canvas }) => createRenderer(canvas as HTMLCanvasElement)}
		style={{ position: "fixed", inset: 0, pointerEvents: "none", ...style }}
	>
		<FrameloopSync frameloop={frameloop} />
		<SizeSync />
		{children}
	</Canvas>
);
