import { createContext } from "react";

/**
 * Seconds an ink stroke waits before it is laid, provided by a staggered container (`Stagger`)
 * so each button's stroke pours in step with its row's entrance rather than all at once.
 */
export const InkDelayContext = createContext(0);
