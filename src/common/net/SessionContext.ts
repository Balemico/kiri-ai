import { createContext } from "react";
import type { SessionValue } from "./types";

export const SessionContext = createContext<SessionValue | undefined>(undefined);
