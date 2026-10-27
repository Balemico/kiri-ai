import { useEffect, useState } from "react";

const QUERY = "(orientation: portrait)";

/** DOM-overlay orientation (window taller than wide). The canvas derives its own from `size`. */
export const useIsPortrait = (): boolean => {
	const [portrait, setPortrait] = useState(() => window.matchMedia(QUERY).matches);
	useEffect(() => {
		const mq = window.matchMedia(QUERY);
		const onChange = () => setPortrait(mq.matches);
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, []);
	return portrait;
};
