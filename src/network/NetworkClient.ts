/**
 * @file Thin wrapper around the Colyseus `Client`. Hides the SDK away from
 * the rest of the codebase so an SDK upgrade is a single-file change.
 *
 * Only this module is allowed to `import { Client } from 'colyseus.js'`.
 *
 * It exposes the four matchmaking flows the menu needs — create, join-public,
 * join-private, and subscribe-to-the-lobby — plus a typed callback API over the
 * built-in {@link https://docs.colyseus.io/builtin-rooms/lobby/ | LobbyRoom}
 * protocol so the menu never touches raw `"rooms"` / `"+"` / `"-"` messages.
 */

import { Client, type Room } from 'colyseus.js';
import {
	ROOM_NAME,
	LOBBY_NAME,
	RoomMode,
	RoomPhase,
	type CreateGameOptions,
	type RoomListItem,
} from '@transcendence/game-shared';

/** Raw room entry as broadcast by the server's LobbyRoom (subset we read). */
interface LobbyRoomCache {
	roomId: string;
	clients: number;
	maxClients: number;
	locked?: boolean;
	metadata?: Partial<RoomListItem>;
}

/** Callbacks invoked as the live public-room list changes. */
export interface LobbyListener {
	/** Full list snapshot (sent once on join, then never again). */
	onReset(rooms: RoomListItem[]): void;
	/** A room was created or updated. */
	onUpsert(room: RoomListItem): void;
	/** A room was removed (disposed) — identified by id. */
	onRemove(roomId: string): void;
}

/** Map a raw LobbyRoom cache entry to the shared {@link RoomListItem} shape. */
function toListItem(roomId: string, cache: LobbyRoomCache): RoomListItem {
	const meta = cache.metadata ?? {};
	return {
		roomId,
		roomName: meta.roomName ?? 'Game',
		mode: meta.mode ?? RoomMode.Public,
		hasPassword: meta.hasPassword ?? false,
		phase: meta.phase ?? RoomPhase.Lobby,
		clients: cache.clients ?? meta.clients ?? 0,
		maxClients: cache.maxClients ?? meta.maxClients ?? 0,
	};
}

export class NetworkClient {
	private readonly client: Client;

	constructor(endpoint: string) {
		this.client = new Client(endpoint);
	}

	/**
	 * Create a brand-new game room as its host.
	 *
	 * @param options - Room name, mode, optional password, host pseudonym.
	 * @returns the joined {@link Room} (the host is its first member).
	 */
	async createGame(options: CreateGameOptions): Promise<Room> {
		return this.client.create(ROOM_NAME, options);
	}

	/**
	 * Join a public room by its id (obtained from the lobby listing).
	 *
	 * @param roomId - Colyseus room id of the target public game.
	 * @param playerName - Joining player's pseudonym.
	 */
	async joinPublic(roomId: string, playerName: string): Promise<Room> {
		return this.client.joinById(roomId, { playerName });
	}

	/**
	 * Join a private room by its name, supplying the host-defined password.
	 *
	 * Matchmaking resolves the room via the server's `filterBy(['roomName'])`;
	 * the password is verified in the room's `onAuth`. A wrong password or
	 * unknown name rejects the returned promise.
	 *
	 * @param roomName - Name of the private game, as set by its host.
	 * @param password - Password to verify.
	 * @param playerName - Joining player's pseudonym.
	 */
	async joinPrivate(roomName: string, password: string, playerName: string): Promise<Room> {
		return this.client.join(ROOM_NAME, { roomName, password, playerName });
	}

	/**
	 * Subscribe to the live directory of public rooms.
	 *
	 * Translates the LobbyRoom's `"rooms"` / `"+"` / `"-"` messages into the
	 * typed {@link LobbyListener} callbacks and returns the underlying room so
	 * the caller can `leave()` it when closing the browser view.
	 */
	async joinLobby(listener: LobbyListener): Promise<Room> {
		const lobby = await this.client.joinOrCreate(LOBBY_NAME);

		lobby.onMessage('rooms', (rooms: [string, LobbyRoomCache][] | LobbyRoomCache[]) => {
			// Colyseus sends the initial snapshot as an array of cache entries.
			const list = (rooms as LobbyRoomCache[]).map((cache) => toListItem(cache.roomId, cache));
			listener.onReset(list);
		});

		lobby.onMessage('+', ([roomId, cache]: [string, LobbyRoomCache]) => {
			listener.onUpsert(toListItem(roomId, cache));
		});

		lobby.onMessage('-', (roomId: string) => {
			listener.onRemove(roomId);
		});

		return lobby;
	}
}
