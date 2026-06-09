import * as BABYLON from '@babylonjs/core';
import * as COLYSEUS from 'colyseus.js';
import networkSettings from './data/network.json';

export class Server {
	private colyseusSDK!: COLYSEUS.Client;

	constructor() {
		this.colyseusSDK = new COLYSEUS.Client(networkSettings.endpoint);
		console.log('Client created');
	}

	async join() {
		try {
			const room = await this.colyseusSDK.joinOrCreate('lobby');
			console.log(`Joined room: ${room.roomId}`);
		} catch (error) {
			console.log('Room creation failed');
		}
	}
}
