import { useEffect, useState } from "react";

/**
 * Returns `value`, but holds back its CHANGES by `delayMs` (the latest change wins). Used to stage
 * portrait CONFIRM animations: each concern reads the same target with a different delay, so they
 * fire in sequence. setState only ever runs inside the timeout (never synchronously in the effect),
 * so it stays clear of the strict react-hooks rule.
 */
export const useLagged = <T>(value: T, delayMs: number): T => {
	const [shown, setShown] = useState(value);
	useEffect(() => {
		if (Object.is(shown, value)) return;
		const t = setTimeout(() => setShown(value), delayMs);
		return () => clearTimeout(t);
	}, [value, shown, delayMs]);
	return shown;
};
