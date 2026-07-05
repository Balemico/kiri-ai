import { useEffect, useState, useSyncExternalStore } from "react";
import { getRelaySockets } from "trystero/nostr";

/**
 * Tiny diagnostics store surfaced in the lobby "waiting" panel. Mobile browsers have no usable
 * console, so the connection health (signaling relays, ICE/TURN source, join errors) must be
 * readable ON SCREEN to debug PC↔mobile sessions.
 */
type NetDiag = { ice: string | null; joinError: string | null };

let snapshot: NetDiag = { ice: null, joinError: null };
const listeners = new Set<() => void>();

export const setDiag = (patch: Partial<NetDiag>) => {
	snapshot = { ...snapshot, ...patch };
	listeners.forEach((l) => l());
};

const subscribe = (l: () => void) => {
	listeners.add(l);
	return () => {
		listeners.delete(l);
	};
};
const getSnapshot = () => snapshot;

/** Live net health: diag store + polled Nostr relay socket states (signaling layer). */
export const useNetDiagnostics = () => {
	const diag = useSyncExternalStore(subscribe, getSnapshot);
	const [relays, setRelays] = useState<{ open: number; total: number } | null>(null);

	useEffect(() => {
		const id = window.setInterval(() => {
			const sockets = Object.values(getRelaySockets() as Record<string, WebSocket>);
			setRelays({ open: sockets.filter((ws) => ws.readyState === WebSocket.OPEN).length, total: sockets.length });
		}, 1500);
		return () => window.clearInterval(id);
	}, []);

	return { ...diag, relays };
};
