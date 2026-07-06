import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { NetworkManager } from './NetworkManager';

export class LobbyScene {
	private scene: BABYLON.Scene;
	private advTex!: GUI.AdvancedDynamicTexture;
	private network: NetworkManager = new NetworkManager();
	private engine: BABYLON.Engine;

	constructor(engine: BABYLON.Engine) {
		this.engine = engine;
		this.scene = new BABYLON.Scene(this.engine);
		new BABYLON.FreeCamera('LobbyCam', BABYLON.Vector3.Zero(), this.scene);
	}

	getScene() {
		return this.scene;
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

	linkControls() {
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

		const setStatus = (text: string) => {
			if (status) status.text = text;
		};

		const setBusy = (busy: boolean) => {
			createButton.isEnabled = !busy;
			joinButton.isEnabled = !busy;
			input.isEnabled = !busy;
		};

		createButton.onPointerUpObservable.add(async () => {
			const roomName = input.text.trim().toLowerCase();
		});
	}
}
