import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import * as COLYSEUS from '@colyseus/sdk';
import type { GameState } from '../../shared-package/src';
import { iconsImport } from './assets/icons';
import { guiImports } from './assets/ui';
import { SceneManager } from './SceneManager';

export class WaitingScreen {
	private advTex!: GUI.AdvancedDynamicTexture;
	private scene: BABYLON.Scene;
	private engine: BABYLON.Engine;
	private room: COLYSEUS.Room<GameState>;
	public readonly ready: Promise<void>;

	constructor(engine: BABYLON.Engine, room: COLYSEUS.Room<GameState>) {
		this.engine = engine;
		this.room = room;
		this.scene = new BABYLON.Scene(this.engine);
		new BABYLON.FreeCamera(
			'EndingScreenCam',
			BABYLON.Vector3.Zero(),
			this.scene,
		);
		this.ready = this.show();
	}

	async render() {
		this.scene.render();
	}

	async show() {
		this.advTex = GUI.AdvancedDynamicTexture.CreateFullscreenUI(
			'WaitingScreen',
			true,
			this.scene,
		);
		this.advTex.idealWidth = 1920;
		this.advTex.idealHeight = 1080;
		this.advTex.renderAtIdealSize = true;
		await this.advTex.parseFromURLAsync(guiImports.waitingScreen);
		this.room.onMessage('gameStart', () => SceneManager.toGame(this.room));
		this.fillData();
		this.connectButton();
	}

	dispose() {
		this.advTex.dispose();
		this.scene.dispose();
	}

	private fillData() {
		const USERNAME = 'Bayle';

		for (let i = 0; i < 4; i++) {
			const pp = this.advTex.getControlByName(
				`ProfilePicture_${i + 1}`,
			) as GUI.Image;

			const usernamePh = this.advTex.getControlByName(
				`Username_${i + 1}`,
			) as GUI.TextBlock;

			const readyIndicator = this.advTex.getControlByName(
				`ReadyIndicator_${i + 1}`,
			) as GUI.Image;

			pp.source = iconsImport.ppPh;
			usernamePh.text = USERNAME;
			readyIndicator.source = iconsImport.readyIndicator;
		}
	}

	private connectButton() {
		const button = this.advTex.getControlByName(
			'ReadyButton',
		) as GUI.Button;

		// TODO
		button.onPointerDownObservable.add(() => {
			const player = this.room.state.players.get(this.room.sessionId);
			if (!player) return;
			this.room.send('ready', !player.ready);
		});
	}
}
