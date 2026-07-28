import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import * as COLYSEUS from '@colyseus/sdk';
import { NetworkManager } from '../NetworkManager';
import { SceneManager } from '../SceneManager';
import type { GameState } from '../../../shared-package/src';
import { guiImports } from '../assets/ui';

export class LobbyScene {
	private scene: BABYLON.Scene;
	private advTex!: GUI.AdvancedDynamicTexture;
	private network: NetworkManager = new NetworkManager();
	private engine: BABYLON.Engine;
	private room!: COLYSEUS.Room<GameState>;
	public readonly ready: Promise<void>;

	constructor(engine: BABYLON.Engine) {
		this.engine = engine;
		this.scene = new BABYLON.Scene(this.engine);
		new BABYLON.FreeCamera('LobbyCam', BABYLON.Vector3.Zero(), this.scene);
		this.ready = this.show();
	}

	getScene() {
		return this.scene;
	}

	async render() {
		this.scene.render();
	}

	async show() {
		this.advTex = GUI.AdvancedDynamicTexture.CreateFullscreenUI(
			'LobbyUi',
			true,
			this.scene,
		);
		this.advTex.idealWidth = 1920;
		this.advTex.idealHeight = 1080;
		this.advTex.renderAtIdealSize = true;
		await this.advTex.parseFromURLAsync(guiImports.lobby);
		this.linkControls();
	}

	dispose() {
		this.scene.dispose();
		this.advTex.dispose();
	}

	getRoom() {
		return this.room;
	}

	private linkControls() {
		const input = this.advTex.getControlByName(
			'RoomNameInput',
		) as GUI.InputText;
		const createButton = this.advTex.getControlByName(
			'ButtonCreate',
		) as GUI.Button;
		const joinButton = this.advTex.getControlByName(
			'ButtonJoin',
		) as GUI.Button;
		const status = this.advTex.getControlByName(
			'StatusText',
		) as GUI.TextBlock;

		if (!createButton || !joinButton || !status || !input) {
			console.error('Missing constrols from lobby.json', {
				input,
				createButton,
				joinButton,
				status,
			});
			return;
		}

		const setStatus = (text: string) => {
			if (status) status.text = text;
		};

		const setBusy = (busy: boolean) => {
			createButton.isEnabled = !busy;
			joinButton.isEnabled = !busy;
			input.isEnabled = !busy;
		};

		const getRoomName = () => {
			const roomName = input.text.trim().toLowerCase();
			if (!roomName) {
				setStatus('Please enter a room name');
				return null;
			}
			return roomName;
		};

		createButton.onPointerUpObservable.add(async () => {
			const roomName = getRoomName();
			if (!roomName) return;
			setBusy(true);
			setStatus('Creating room...');
			try {
				this.room = await this.network.createRoom(roomName);
				setStatus(`Room "${roomName}" created`);
				setBusy(false);
				if (this.room) {
					await SceneManager.toGame(this.room);
				}
			} catch (error) {
				console.log(error);
				setStatus('Failed to create room');
			}
		});

		joinButton.onPointerUpObservable.add(async () => {
			const roomName = getRoomName();
			if (!roomName) return;
			setBusy(true);
			setStatus('Joining room...');
			try {
				this.room = await this.network.joinRoomByName(roomName);
				setStatus(`Joined "${roomName}"`);
				setBusy(false);
				if (this.room) {
					await SceneManager.toGame(this.room);
				}
			} catch (error) {
				console.log(error);
				setStatus('Failed to join room');
			}
		});
	}
}
