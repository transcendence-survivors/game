import { Client } from '@colyseus/sdk';
import {
	GAME_ROOM_TYPE,
	normalizeRoomName,
	type GameState,
} from '@transcendence/game-shared';

export class NetworkManager {
	private client!: Client;

	constructor() {
		const host = window.location.hostname;
		this.client = new Client(`ws://${host}:4000`);
	}

	createRoom(rawName: string) {
		const roomName = normalizeRoomName(rawName);
		if (!roomName) throw new Error('Empty room name');
		return this.client.create<GameState>(GAME_ROOM_TYPE, { roomName });
	}

	joinRoomByName(rawName: string) {
		const roomName = normalizeRoomName(rawName);
		if (!roomName) throw new Error('Empty room name');
		return this.client.join<GameState>(GAME_ROOM_TYPE, { roomName });
	}
}
