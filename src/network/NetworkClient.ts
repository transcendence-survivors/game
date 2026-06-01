/**
 * @file Thin wrapper around the Colyseus `Client`. Hides the SDK away from
 * the rest of the codebase so an SDK upgrade is a single-file change.
 *
 * Only this module is allowed to `import { Client } from 'colyseus.js'`.
 */

import { Client, type Room } from 'colyseus.js';
import { ROOM_NAME } from '@transcendence/game-shared';

export class NetworkClient {
	private readonly client: Client;

	constructor(endpoint: string) {
		this.client = new Client(endpoint);
	}

	/**
	 * Join the canonical game room, or create it if none is available.
	 *
	 * @returns the joined Colyseus {@link Room}. The caller is responsible for
	 *   wiring state callbacks and calling `room.leave()` on shutdown.
	 */
	async joinGame(): Promise<Room> {
		return this.client.joinOrCreate(ROOM_NAME);
	}
}
