import { useEffect, useState } from "react";

/**
 * True when the primary pointer is coarse (touch / no hover). Drives the mobile interaction model:
 * cards are LIFTED on the first tap and CONFIRMED on the second, instead of hover-to-lift / click-to-place.
 * Reactive to input changes (e.g. plugging a mouse into a tablet) via the `(pointer: coarse)` media query.
 */
export const useCoarsePointer = (): boolean => {
	const [coarse, setCoarse] = useState(
		() => typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches,
	);
	useEffect(() => {
		const mq = window.matchMedia("(pointer: coarse)");
		const onChange = () => setCoarse(mq.matches);
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, []);
	return coarse;
};
