import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode } from "react";
import { joinRoom, type Room } from "trystero/nostr";
import { distributeSpecials, type CardId, type GameAction, type Team } from "../game";
import { SessionContext } from "./SessionContext";
import type { Mode, SessionStatus, SessionValue } from "./types";
import type { NetMessage, Placement } from "./protocol";

/** Namespaces the P2P rooms — only clients sharing this appId (+ the keyword) can find each other. */
const APP_ID = "kiri-ai-duel-v1";
const other = (t: Team): Team => (t === "red" ? "blue" : "red");

/**
 * WebRTC ICE servers. Trystero handles signaling but sets NO ICE servers by default, so peers only
 * gather host candidates (often mDNS) and the connection can fail with "ICE failed, add a TURN server".
 *  - STUN discovers each peer's public address → fixes most same-network / localhost / two-tab cases.
 *  - TURN relays the stream when a direct P2P path is blocked (restrictive NAT / firewall) — the
 *    guaranteed fallback. The bundled TURN is a best-effort public relay; for reliable cross-network
 *    play provide your own via `VITE_ICE_SERVERS` (a JSON array of RTCIceServer).
 */
// Kept to ≤4 URLs — Trystero warns that 5+ ICE servers slow discovery down.
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
	{ urls: "stun:stun.l.google.com:19302" },
	{
		urls: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:443?transport=tcp"],
		username: "openrelayproject",
		credential: "openrelayproject",
	},
];

const ICE_SERVERS: RTCIceServer[] = (() => {
	const raw = import.meta.env.VITE_ICE_SERVERS as string | undefined;
	if (!raw) return DEFAULT_ICE_SERVERS;
	try {
		return JSON.parse(raw) as RTCIceServer[];
	} catch {
		console.warn("VITE_ICE_SERVERS is not valid JSON — falling back to the default ICE servers.");
		return DEFAULT_ICE_SERVERS;
	}
})();

const RTC_CONFIG: RTCConfiguration = { iceServers: ICE_SERVERS };

type Specials = { red: CardId; blue: CardId };

/**
 * Owns the game mode + the Trystero P2P connection. It does NOT own game state — it hands the
 * networked pieces (viewerTeam, host role, send/relay, a receiver binding) to GameProvider, which
 * wraps the engine's dispatch around them.
 */
export const SessionProvider = ({ children }: { children: ReactNode }) => {
	const [mode, setMode] = useState<Mode>("local");
	const [status, setStatus] = useState<SessionStatus>("menu");
	const [localTeam, setLocalTeam] = useState<Team | null>(null);
	const [activeTeam, setActiveTeam] = useState<Team>("red");
	const [roomKeyword, setRoomKeyword] = useState<string | null>(null);
	const [specials, setSpecials] = useState<Specials | null>(null);
	const [isHost, setIsHost] = useState(false);

	const roomRef = useRef<Room | null>(null);
	const sendRef = useRef<((msg: NetMessage) => void) | null>(null);
	// The engine's raw dispatch, bound once GameProvider mounts. Messages that arrive before then
	// are queued and flushed on bind (tiny window; human placement is seconds away regardless).
	const receiverRef = useRef<Dispatch<GameAction> | null>(null);
	const pendingRef = useRef<GameAction[]>([]);
	// Mirror the bits the Trystero handlers read, so their closures never go stale.
	const infoRef = useRef<{ isHost: boolean; localTeam: Team | null; specials: Specials | null }>({
		isHost: false,
		localTeam: null,
		specials: null,
	});
	useEffect(() => {
		infoRef.current = { isHost, localTeam, specials };
	}, [isHost, localTeam, specials]);

	const applyOrQueue = useCallback((action: GameAction) => {
		if (receiverRef.current) receiverRef.current(action);
		else pendingRef.current.push(action);
	}, []);

	const bindReceiver = useCallback((dispatch: Dispatch<GameAction>) => {
		receiverRef.current = dispatch;
		if (pendingRef.current.length) {
			const queued = pendingRef.current;
			pendingRef.current = [];
			queued.forEach(dispatch);
		}
		return () => {
			receiverRef.current = null;
		};
	}, []);

	const handleMessage = useCallback(
		(msg: NetMessage) => {
			switch (msg.kind) {
				case "hello": {
					// A guest just connected → the host replies with the shared setup and starts.
					const { isHost: host, specials: sp, localTeam: team } = infoRef.current;
					if (host && sp && team) {
						sendRef.current?.({ kind: "init", specials: sp, hostTeam: team });
						setStatus("playing");
					}
					return;
				}
				case "init": {
					// Guest: adopt the shared distribution and take the opposite colour.
					const myTeam = other(msg.hostTeam);
					infoRef.current.localTeam = myTeam;
					infoRef.current.specials = msg.specials;
					setLocalTeam(myTeam);
					setActiveTeam(myTeam);
					setSpecials(msg.specials);
					setStatus("playing");
					return;
				}
				case "commit": {
					// Re-hydrate the opponent's committed cards, then confirm them. When both teams are
					// confirmed the reducer advances to "ready" on this client too.
					msg.placements.forEach((pl) =>
						applyOrQueue({ type: "PLACE_CARD", team: msg.team, slot: pl.slot, cardId: pl.cardId, side: pl.side })
					);
					applyOrQueue({ type: "CONFIRM_SELECTION", team: msg.team });
					return;
				}
				case "phase": {
					applyOrQueue(msg.action);
					return;
				}
			}
		},
		[applyOrQueue]
	);

	/** Join a Trystero room and wire the message channel. */
	const connect = useCallback(
		(keyword: string): Room => {
			const room = joinRoom({ appId: APP_ID, rtcConfig: RTC_CONFIG }, keyword);
			const channel = room.makeAction("msg");
			roomRef.current = room;
			// Cast through unknown: our JSON messages satisfy Trystero's DataPayload at runtime.
			sendRef.current = (msg: NetMessage) => void channel.send(msg as unknown as Parameters<typeof channel.send>[0]);
			channel.onMessage = (data) => handleMessage(data as unknown as NetMessage);
			room.onPeerLeave = () => setStatus("peer-left");
			return room;
		},
		[handleMessage]
	);

	const createRoom = useCallback(
		(keyword: string, color: Team) => {
			const sp = distributeSpecials();
			infoRef.current = { isHost: true, localTeam: color, specials: sp };
			setMode("online");
			setIsHost(true);
			setLocalTeam(color);
			setActiveTeam(color);
			setRoomKeyword(keyword);
			setSpecials(sp);
			setStatus("waiting");
			const room = connect(keyword);
			room.onPeerJoin = () => {
				// Proactively send init; the guest's hello also triggers it as an ordering fallback.
				sendRef.current?.({ kind: "init", specials: sp, hostTeam: color });
				setStatus("playing");
			};
		},
		[connect]
	);

	const joinRoomFn = useCallback(
		(keyword: string) => {
			infoRef.current = { isHost: false, localTeam: null, specials: null };
			setMode("online");
			setIsHost(false);
			setLocalTeam(null);
			setRoomKeyword(keyword);
			setStatus("waiting");
			const room = connect(keyword);
			// Ask the host for the shared setup (guarantees both listeners are up before init flows).
			room.onPeerJoin = () => sendRef.current?.({ kind: "hello" });
		},
		[connect]
	);

	const leave = useCallback(() => {
		void roomRef.current?.leave();
		roomRef.current = null;
		sendRef.current = null;
		receiverRef.current = null;
		pendingRef.current = [];
		infoRef.current = { isHost: false, localTeam: null, specials: null };
		setMode("local");
		setStatus("menu");
		setLocalTeam(null);
		setActiveTeam("red");
		setRoomKeyword(null);
		setSpecials(null);
		setIsHost(false);
	}, []);

	const startLocal = useCallback(() => {
		setMode("local");
		setLocalTeam(null);
		setActiveTeam("red");
		setSpecials(null);
		setIsHost(false);
		setStatus("playing");
	}, []);

	const sendCommit = useCallback((team: Team, placements: Placement[]) => {
		sendRef.current?.({ kind: "commit", team, placements });
	}, []);
	const sendPhase = useCallback((action: GameAction) => {
		sendRef.current?.({ kind: "phase", action });
	}, []);

	const advanceActiveTeam = useCallback(() => setActiveTeam((t) => other(t)), []);
	const resetActiveTeam = useCallback(() => setActiveTeam("red"), []);

	// Leave the room if the provider ever unmounts.
	useEffect(
		() => () => {
			void roomRef.current?.leave();
		},
		[]
	);

	const viewerTeam: Team = mode === "local" ? activeTeam : localTeam ?? "red";

	const value = useMemo<SessionValue>(
		() => ({
			mode,
			status,
			localTeam,
			activeTeam,
			viewerTeam,
			isHost,
			roomKeyword,
			specials,
			startLocal,
			createRoom,
			joinRoom: joinRoomFn,
			leave,
			bindReceiver,
			sendCommit,
			sendPhase,
			advanceActiveTeam,
			resetActiveTeam,
		}),
		[
			mode,
			status,
			localTeam,
			activeTeam,
			viewerTeam,
			isHost,
			roomKeyword,
			specials,
			startLocal,
			createRoom,
			joinRoomFn,
			leave,
			bindReceiver,
			sendCommit,
			sendPhase,
			advanceActiveTeam,
			resetActiveTeam,
		]
	);

	return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};
