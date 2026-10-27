import { Suspense } from "react";
import { Environment } from "@react-three/drei";

// drei's `preset="sunset"`, self-hosted: the preset streams the HDRI from an external CDN, which
// took up to ~10 s (and would hang forever offline) — and while it loads it suspends the scene.
const ENV_HDRI = "/hdri/venice_sunset_1k.hdr";

/**
 * Scene lighting. The environment map only feeds the cards' standard materials (scenery, floor
 * and pawns are unlit), so it sits in its OWN Suspense boundary: it can never hold back the
 * duel's first frame — at worst the cards pick up their reflections a beat later.
 */
export const Lights = () => (
	<>
		<ambientLight />
		<pointLight position={[10, 10, 10]} />
		<Suspense fallback={null}>
			<Environment files={ENV_HDRI} />
		</Suspense>
	</>
);
