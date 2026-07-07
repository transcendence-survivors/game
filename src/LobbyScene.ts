import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { NetworkManager } from './NetworkManager';
import { GameScene } from './scenes/GameScene';
import { SceneManager } from './SceneManager';

export class LobbyScene {
	private scene: BABYLON.Scene;
	private advTex!: GUI.AdvancedDynamicTexture;
	private network: NetworkManager = new NetworkManager();
	private engine: BABYLON.Engine;
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
		await this.advTex.parseFromURLAsync('/ui/lobby.json');
		this.linkControls();
	}

	dispose() {
		this.scene.dispose();
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
				this.network.createRoom(roomName);
				setStatus(`Room "${roomName}" created`);
			} catch (error) {
				console.log(error);
				setStatus('Failed to create room');
			} finally {
				setBusy(false);
				SceneManager.toGame();
				const gamescene = new GameScene(this.engine);
				this.scene.dispose();
				gamescene.render();
			}
		});

		joinButton.onPointerUpObservable.add(async () => {
			const roomName = getRoomName();
			if (!roomName) return;
			setBusy(true);
			setStatus('Joining room...');
			try {
				this.network.joinRoomByName(roomName);
				setStatus(`Joined "${roomName}"`);
			} catch (error) {
				console.log(error);
				setStatus('Failed to join room');
			} finally {
				setBusy(false);
				SceneManager.toGame();
				const gamescene = new GameScene(this.engine);
				this.scene.dispose();
				gamescene.render();
			}
		});
	}
}
