import { folder, useControls } from "leva";
import type { Orientation } from "../layout";

/** A Leva schema literal (param name → control spec), taken from `folder`'s own parameter type. */
type Schema = Parameters<typeof folder>[0];

/**
 * Present a single Leva folder with two sub-folders — `Landscape` and `Portrait` — each holding the
 * family's full parameter set, and return the values for the ACTIVE orientation. Both sub-folders are
 * always registered (so either can be tuned at any time); the window orientation just selects which
 * set the scene reads. Pass distinct schemas when the two orientations want different defaults.
 */
export const useOrientationFolder = <T>(name: string, landscape: Schema, portrait: Schema, orientation: Orientation): T => {
	const ls = useControls(name, { Landscape: folder(landscape, { collapsed: true }) }, { collapsed: true });
	const pt = useControls(name, { Portrait: folder(portrait, { collapsed: true }) }, { collapsed: true });
	return (orientation === "portrait" ? pt : ls) as T;
};
