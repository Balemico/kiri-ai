import { useContext } from "react";
import { SessionContext } from "./SessionContext";

export const useSession = () => {
	const ctx = useContext(SessionContext);
	if (!ctx) throw new Error("useSession must be used within a SessionProvider");
	return ctx;
};
