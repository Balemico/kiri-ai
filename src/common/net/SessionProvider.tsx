import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode } from "react";
import { joinRoom, getRelaySockets, type Room } from "trystero/nostr";
import { distributeSpecials, type CardId, type GameAction, type Team } from "../game";
import { trackGameMode } from "../analytics";
import { SessionContext } from "./SessionContext";
import { getIceServers } from "./iceServers";
import type { Mode, SessionStatus, SessionValue } from "./types";
import type { NetMessage, Placement } from "./protocol";

/** Namespaces the P2P rooms — only clients sharing this appId (+ the keyword) can find each other. */
const APP_ID = "kiri-ai-duel-v1";
const other = (t: Team): Team => (t === "red" ? "blue" : "red");

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
	// Bumped on leave/unmount: a `connect` that was awaiting TURN credentials when the user left
	// sees a stale generation and bails instead of creating a room nobody owns.
	const connectGenRef = useRef(0);
	const localSessionRef = useRef(0);
	const trackedSessionRef = useRef<string | null>(null);
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

	/** Fetch ICE servers (short-lived TURN credentials), then join a Trystero room and wire the
	 * message channel. Returns null if the session was left while credentials were in flight. */
	const connect = useCallback(
		async (keyword: string): Promise<Room | null> => {
			const gen = connectGenRef.current;
			const iceServers = await getIceServers();
			if (gen !== connectGenRef.current) return null;
			// `onJoinError` fires on password/handshake failures (incl. handshake timeout).
			const room = joinRoom({ appId: APP_ID, rtcConfig: { iceServers } }, keyword, {
				onJoinError: (details) => console.error("[net] join error", details),
			});
			const channel = room.makeAction("msg");
			roomRef.current = room;
			// Cast through unknown: our JSON messages satisfy Trystero's DataPayload at runtime.
			sendRef.current = (msg: NetMessage) => void channel.send(msg as unknown as Parameters<typeof channel.send>[0]);
			channel.onMessage = (data) => handleMessage(data as unknown as NetMessage);
			room.onPeerLeave = (peerId) => {
				console.warn("[net] peer left", peerId);
				setStatus("peer-left");
			};

			// Signaling health: log which Nostr relays actually connected. If this stays empty the two
			// devices can NEVER find each other (relay problem, not WebRTC). If relays are connected but
			// `onPeerJoin` never fires cross-network, it's a WebRTC/TURN problem instead.
			window.setTimeout(() => {
				const sockets = getRelaySockets() as Record<string, WebSocket>;
				const entries = Object.entries(sockets);
				const open = entries.filter(([, ws]) => ws.readyState === WebSocket.OPEN).map(([url]) => url);
				console.info(`[net] relay sockets: ${open.length}/${entries.length} open`, open);
			}, 3000);
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
			void connect(keyword).then((room) => {
				if (!room) return;
				room.onPeerJoin = (peerId) => {
					console.info("[net] peer joined (host)", peerId);
					// Proactively send init; the guest's hello also triggers it as an ordering fallback.
					sendRef.current?.({ kind: "init", specials: sp, hostTeam: color });
					setStatus("playing");
				};
			});
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
			void connect(keyword).then((room) => {
				if (!room) return;
				// Ask the host for the shared setup (guarantees both listeners are up before init flows).
				room.onPeerJoin = (peerId) => {
					console.info("[net] peer joined (guest)", peerId);
					sendRef.current?.({ kind: "hello" });
				};
			});
		},
		[connect]
	);

	const leave = useCallback(() => {
		connectGenRef.current += 1;
		void roomRef.current?.leave();
		roomRef.current = null;
		sendRef.current = null;
		receiverRef.current = null;
		pendingRef.current = [];
		infoRef.current = { isHost: false, localTeam: null, specials: null };
		trackedSessionRef.current = null;
		setMode("local");
		setStatus("menu");
		setLocalTeam(null);
		setActiveTeam("red");
		setRoomKeyword(null);
		setSpecials(null);
		setIsHost(false);
	}, []);

	const startLocal = useCallback(() => {
		localSessionRef.current += 1;
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

	// Leave the room if the provider ever unmounts (and cancel any in-flight connect).
	useEffect(
		() => () => {
			connectGenRef.current += 1;
			void roomRef.current?.leave();
		},
		[]
	);

	useEffect(() => {
		if (status !== "playing") return;
		const sessionId = mode === "local" ? `passplay-${localSessionRef.current}` : `multiplayer-${roomKeyword ?? "unknown"}`;
		if (trackedSessionRef.current === sessionId) return;
		trackedSessionRef.current = sessionId;
		trackGameMode(mode === "local" ? "passplay" : "multiplayer");
	}, [status, mode, roomKeyword]);

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
