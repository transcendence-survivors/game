import type { Scene } from '@babylonjs/core';
import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';

export class SettingsMenuRender {
	private scene: Scene;
	private engine: BABYLON.Engine;
	private advTex!: GUI.AdvancedDynamicTexture;
	public readonly ready: Promise<void>;
	private camera!: BABYLON.ArcRotateCamera;

	constructor(
		engine: BABYLON.Engine,
		scene: Scene,
		camera: BABYLON.ArcRotateCamera,
	) {
		this.scene = scene;
		this.engine = engine;
		this.camera = camera;
		this.ready = this.init();
	}

	async render() {
		this.scene.render();
	}

	async init() {
		this.advTex = GUI.AdvancedDynamicTexture.CreateFullscreenUI(
			'SettingsUi',
			true,
			this.scene,
		);
		await this.advTex.parseFromURLAsync('/ui/settings_menu.json');
		this.advTex.rootContainer.isVisible = false;
		this.linkControls();
	}

	dispose() {
		this.advTex.dispose();
		this.scene.dispose();
	}

	openSettings() {
		this.advTex.rootContainer.isVisible = true;
	}

	closeSettings() {
		this.advTex.rootContainer.isVisible = false;
	}

	private linkControls() {
		const fovSlider = this.advTex.getControlByName(
			'FovSlider',
		) as GUI.Slider;
		const fovValue = this.advTex.getControlByName(
			'FovValue',
		) as GUI.TextBlock;

		if (!fovSlider) return;
		fovSlider.onValueChangedObservable.add((value) => {
			const rounded = Math.round(value);
			fovValue.text = rounded + '°';
			this.camera.fov = BABYLON.Tools.ToRadians(rounded);
		});

		const buttonBack = this.advTex.getControlByName(
			'ButtonBack',
		) as GUI.Button;

		const buttonReset = this.advTex.getControlByName(
			'ButtonReset',
		) as GUI.Button;

		const forwardKey = this.advTex.getControlByName(
			'Key_Forward',
		) as GUI.Button;

		const backwarddKey = this.advTex.getControlByName(
			'Key_Backward',
		) as GUI.Button;

		const rightKey = this.advTex.getControlByName(
			'Key_Right',
		) as GUI.Button;

		const leftKey = this.advTex.getControlByName('Key_Left') as GUI.Button;

		const jumpKey = this.advTex.getControlByName('Key_Jump') as GUI.Button;
	}
}
