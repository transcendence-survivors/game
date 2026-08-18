import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import * as COLYSEUS from '@colyseus/sdk';
import { NetworkManager } from '../NetworkManager';
import { SceneManager } from '../SceneManager';
import { normalizeRoomName, type GameState } from '@transcendence/game-shared';
import { createFullscreenUi, getGuiControls, guiImports } from '../assets/ui';

interface LobbyControls {
	input: GUI.InputText;
	createButton: GUI.Button;
	joinButton: GUI.Button;
	status: GUI.TextBlock;
}

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

	render() {
		this.scene.render();
	}

	async show() {
		this.advTex = createFullscreenUi('LobbyUi', this.scene);
		await this.advTex.parseFromURLAsync(guiImports.lobby);
		this.linkControls();
	}

	dispose() {
		this.scene.dispose();
		this.advTex.dispose();
	}

	private linkControls() {
		const { input, createButton, joinButton, status } =
			getGuiControls<LobbyControls>(this.advTex, {
				input: 'RoomNameInput',
				createButton: 'ButtonCreate',
				joinButton: 'ButtonJoin',
				status: 'StatusText',
			});

		const setStatus = (text: string) => {
			status.text = text;
		};

		const setBusy = (busy: boolean) => {
			createButton.isEnabled = !busy;
			joinButton.isEnabled = !busy;
			input.isEnabled = !busy;
		};

		const getRoomName = () => {
			const roomName = normalizeRoomName(input.text);
			if (!roomName) {
				setStatus('Please enter a room name');
				return null;
			}
			return roomName;
		};

		const enterRoom = async (create: boolean) => {
			const roomName = getRoomName();
			if (!roomName) return;
			setBusy(true);
			setStatus(create ? 'Creating room...' : 'Joining room...');
			try {
				this.room = create
					? await this.network.createRoom(roomName)
					: await this.network.joinRoomByName(roomName);
				setStatus(
					create
						? `Room "${roomName}" created`
						: `Joined "${roomName}"`,
				);
				setBusy(false);
				if (this.room) await SceneManager.toGame(this.room);
			} catch (error) {
				console.error('Room connection failed', error);
				setStatus(
					create ? 'Failed to create room' : 'Failed to join room',
				);
			}
		};

		createButton.onPointerUpObservable.add(() => enterRoom(true));
		joinButton.onPointerUpObservable.add(() => enterRoom(false));
	}
}
