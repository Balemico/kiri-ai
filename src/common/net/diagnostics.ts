import { useEffect, useState, useSyncExternalStore } from "react";
import { getRelaySockets } from "trystero/nostr";

/**
 * Tiny diagnostics store surfaced in the lobby "waiting" panel. Mobile browsers have no usable
 * console, so the connection health (signaling relays, ICE/TURN source, join errors) must be
 * readable ON SCREEN to debug PC↔mobile sessions.
 */
type NetDiag = { ice: string | null; joinError: string | null; rtc: string | null };

let snapshot: NetDiag = { ice: null, joinError: null, rtc: null };
const listeners = new Set<() => void>();

export const setDiag = (patch: Partial<NetDiag>) => {
	snapshot = { ...snapshot, ...patch };
	listeners.forEach((l) => l());
};

/**
 * Trystero doesn't expose its RTCPeerConnections, so wrap the constructor to surface ICE progress
 * in the lobby. Behavior is untouched — we only listen to state events. Reading the `rtc` label:
 *  - stays empty while waiting → peers never even found each other (signaling problem);
 *  - "checking" → offer/answer exchanged, ICE probing paths (signaling OK);
 *  - "failed" → no path found even via TURN (TURN/credentials problem);
 *  - "connected" → the WebRTC hop is fine.
 */
const NativePC = window.RTCPeerConnection;
let pcCount = 0;
window.RTCPeerConnection = class extends NativePC {
	constructor(...args: ConstructorParameters<typeof RTCPeerConnection>) {
		super(...args);
		const id = ++pcCount;
		setDiag({ rtc: `#${id} creata` });
		this.addEventListener("iceconnectionstatechange", () => setDiag({ rtc: `#${id} ${this.iceConnectionState}` }));
	}
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
