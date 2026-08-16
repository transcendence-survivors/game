import { Client } from '@colyseus/sdk';
import type { GameState } from '@transcendence/game-shared';

export class NetworkManager {
	private client!: Client;

	constructor() {
		const host = window.location.hostname;
		this.client = new Client(`ws://${host}:4000`);
	}

	normalize(name: string) {
		return name.trim().toLowerCase();
	}

	async createRoom(rawName: string) {
		const roomName = this.normalize(rawName);
		if (!roomName) throw new Error('Empty room name');
		try {
			return await this.client.create<GameState>('game_room', {
				roomName,
			});
		} catch (error) {
			throw error;
		}
	}

	async joinRoomByName(rawName: string) {
		const roomName = this.normalize(rawName);
		if (!roomName) throw new Error('Empty room name');
		try {
			return await this.client.join<GameState>('game_room', { roomName });
		} catch (error) {
			throw error;
		}
	}
}
