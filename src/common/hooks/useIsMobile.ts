import { useEffect, useState } from "react";

// A touch screen, or a phone-sized window either way round (devtools emulation, phones whose
// browser doesn't report a coarse pointer).
const QUERY = "(pointer: coarse), (max-width: 820px), (max-height: 500px)";

/** DOM-overlay "is this a phone/tablet" — reactive to resizes and input changes. */
export const useIsMobile = (): boolean => {
	const [mobile, setMobile] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(QUERY).matches);
	useEffect(() => {
		const mq = window.matchMedia(QUERY);
		const onChange = () => setMobile(mq.matches);
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, []);
	return mobile;
};
