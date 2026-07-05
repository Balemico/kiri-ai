/**
 * WebRTC ICE server acquisition. Trystero handles signaling but sets NO ICE servers by default,
 * so peers only gather host candidates and the connection fails on any non-trivial network.
 *  - STUN discovers each peer's public address → fixes most same-network / two-PC cases.
 *  - TURN relays the traffic when a direct P2P path is blocked (restrictive NAT / carrier CGNAT
 *    on mobile) — the guaranteed fallback WITHOUT which PC↔mobile stays stuck in the lobby.
 *
 * Resolution order:
 *  1. `VITE_ICE_SERVERS` (full JSON array of RTCIceServer) — build-time override, replaces all.
 *  2. `/api/turn-credentials` — Vercel function minting short-lived Cloudflare TURN credentials
 *     (see `api/turn-credentials.ts`). Cached here until shortly before their TTL expires.
 *  3. Static fallback: Google STUN + optional `VITE_TURN_URLS`/`VITE_TURN_USERNAME`/
 *     `VITE_TURN_CREDENTIAL`. This is also the `yarn dev` path (Vite doesn't serve `/api`).
 */

const STUN_ONLY: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

let cached: { servers: RTCIceServer[]; expiresAt: number } | null = null;

const staticFallback = (): RTCIceServer[] => {
	const servers: RTCIceServer[] = [...STUN_ONLY];
	const turnUrls = (import.meta.env.VITE_TURN_URLS as string | undefined)
		?.split(",")
		.map((u) => u.trim())
		.filter(Boolean);
	const username = import.meta.env.VITE_TURN_USERNAME as string | undefined;
	const credential = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;
	if (turnUrls?.length && username && credential) servers.push({ urls: turnUrls, username, credential });
	else console.warn("[net] STUN only — PC↔mobile (CGNAT) connections will likely fail without TURN.");
	return servers;
};

export const getIceServers = async (): Promise<RTCIceServer[]> => {
	// Advanced override: a full JSON array replaces the whole ICE config (STUN included).
	const raw = import.meta.env.VITE_ICE_SERVERS as string | undefined;
	if (raw) {
		try {
			return JSON.parse(raw) as RTCIceServer[];
		} catch {
			console.warn("VITE_ICE_SERVERS is not valid JSON — ignoring it.");
		}
	}

	if (cached && Date.now() < cached.expiresAt) return cached.servers;

	try {
		const res = await fetch("/api/turn-credentials");
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const { iceServers, ttl } = (await res.json()) as { iceServers: RTCIceServer[]; ttl: number };
		if (!Array.isArray(iceServers) || iceServers.length === 0) throw new Error("empty iceServers");
		// Refresh 5 min before expiry so a credential never goes stale mid-handshake.
		cached = { servers: iceServers, expiresAt: Date.now() + Math.max(ttl - 300, 60) * 1000 };
		console.info(`[net] TURN credentials fetched (ttl ${ttl}s)`);
		return iceServers;
	} catch (err) {
		console.warn("[net] TURN credential fetch failed — falling back to static ICE config.", err);
		return staticFallback();
	}
};
