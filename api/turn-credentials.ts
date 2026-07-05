/**
 * Vercel serverless function (Node runtime, Web API signature) — generates short-lived Cloudflare
 * TURN credentials for the WebRTC clients. Cloudflare's TURN service has NO static credentials:
 * they must be minted via API with a TTL, so the secret key lives here (server-side env) and the
 * client fetches fresh credentials from this endpoint before joining a room.
 *
 * Env (Vercel project settings, NOT `VITE_*` — these must never reach the client bundle):
 *  - `TURN_KEY_ID`         Cloudflare "Turn Token ID" (dash.cloudflare.com → Realtime → TURN keys)
 *  - `TURN_KEY_API_TOKEN`  the key's API token (shown once at creation)
 */

const CF_TURN_API = "https://rtc.live.cloudflare.com/v1/turn/keys";

/** 6h: outlives any duel by far, but bounds how long scraped credentials stay usable. */
const TTL_SECONDS = 21600;

/** Local structural type — this file is outside the app tsconfig, so no DOM lib assumptions. */
type IceServer = { urls: string | string[]; username?: string; credential?: string };

/**
 * Some carriers/networks block UDP and every port except 443. Cloudflare's TURN listens on
 * 443/TLS too, but its API response only advertises 5349 — append the 443 variant ourselves.
 */
const withTls443 = (server: IceServer): IceServer => {
	const urls = Array.isArray(server.urls) ? [...server.urls] : [server.urls];
	const isCloudflareTurn = server.username && urls.some((u) => u.includes("turn.cloudflare.com"));
	if (isCloudflareTurn && !urls.some((u) => u.includes(":443"))) {
		urls.push("turns:turn.cloudflare.com:443?transport=tcp");
	}
	return { ...server, urls };
};

export async function GET(): Promise<Response> {
	const keyId = process.env.TURN_KEY_ID;
	const apiToken = process.env.TURN_KEY_API_TOKEN;
	if (!keyId || !apiToken) {
		return Response.json({ error: "TURN_KEY_ID / TURN_KEY_API_TOKEN not configured" }, { status: 500 });
	}

	const upstream = await fetch(`${CF_TURN_API}/${keyId}/credentials/generate-ice-servers`, {
		method: "POST",
		headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
		body: JSON.stringify({ ttl: TTL_SECONDS }),
	});
	if (!upstream.ok) {
		return Response.json({ error: `Cloudflare TURN API responded ${upstream.status}` }, { status: 502 });
	}

	const { iceServers } = (await upstream.json()) as { iceServers: IceServer[] };
	return Response.json(
		{ iceServers: iceServers.map(withTls443), ttl: TTL_SECONDS },
		{ headers: { "Cache-Control": "no-store" } }
	);
}
