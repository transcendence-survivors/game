import type { Engine, Scene } from '@babylonjs/core';
import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { SceneManager } from '../SceneManager';

export class MainMenuScene {
	private engine: Engine;
	private scene: Scene;
	public readonly ready: Promise<void>;
	private advTex!: GUI.AdvancedDynamicTexture;

	constructor(engine: Engine) {
		this.engine = engine;
		this.scene = new BABYLON.Scene(this.engine);
		this.scene.clearColor = new BABYLON.Color4(0.07, 0.06, 0.055, 1);

		new BABYLON.FreeCamera('MenuCam', BABYLON.Vector3.Zero(), this.scene);
		const light = new BABYLON.HemisphericLight(
			'ambientLight',
			new BABYLON.Vector3(0, 1, 0),
			this.scene,
		);
		light.intensity = 0.6;
		light.diffuse = BABYLON.Color3.FromHexString('#E5A832');
		light.groundColor = BABYLON.Color3.FromHexString('#131110');
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
			'MainMenuUi',
			true,
			this.scene,
		);
		await this.advTex.parseFromURLAsync('/ui/main_menu.json');
		this.linkControls();
	}

	dispose() {
		this.scene.dispose();
		this.advTex.dispose();
	}

	private linkControls() {
		const playButton = this.advTex.getControlByName(
			'PlayButton',
		) as GUI.Button;
		if (!playButton) {
			console.error('Missing PlayButton from main_menu.json', {
				playButton,
			});
			return;
		}
		const idleBackground = '#E5A832';
		const hoverBackground = '#D8982A';

		playButton.onPointerEnterObservable.add(() => {
			playButton.background = hoverBackground;
		});
		playButton.onPointerOutObservable.add(() => {
			playButton.background = idleBackground;
		});

		playButton.onPointerUpObservable.add(() => {
			this.dispose();
			SceneManager.toLobby();
		});
	}
}
