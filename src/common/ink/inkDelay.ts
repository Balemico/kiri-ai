import { createContext } from "react";

/**
 * Row timing handed to the ink by a staggered container (`Stagger`), in seconds: `enter` = how
 * long a stroke waits before it is laid (in step with its row's entrance); `exit` = how long it
 * waits, once its view is leaving, before it lifts (rows leave in reverse order).
 */
export interface InkTiming {
	enter: number;
	exit: number;
}

export const InkDelayContext = createContext<InkTiming>({ enter: 0, exit: 0 });
