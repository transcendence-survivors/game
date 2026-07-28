import type { Scene } from '@babylonjs/core';
import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import type { KeyBindings } from '../scenes/GameScene';
import { guiImports } from '../assets/ui';

export class SettingsMenuRender {
	private scene: Scene;
	private engine: BABYLON.Engine;
	private advTex!: GUI.AdvancedDynamicTexture;
	public readonly ready: Promise<void>;
	private camera!: BABYLON.ArcRotateCamera;
	private keybinds: KeyBindings;
	private awaitingBindFor: keyof KeyBindings | null = null;

	constructor(
		engine: BABYLON.Engine,
		scene: Scene,
		camera: BABYLON.ArcRotateCamera,
		keybinds: KeyBindings,
	) {
		this.scene = scene;
		this.engine = engine;
		this.camera = camera;
		this.keybinds = keybinds;
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
		await this.advTex.parseFromURLAsync(guiImports.settings);
		this.advTex.rootContainer.isVisible = false;
		this.updatePointerEvents();
		this.linkControls();
	}

	dispose() {
		document.removeEventListener('keydown', this.boundKeyDown);
		this.advTex.dispose();
		this.scene.dispose();
	}

	isOpen() {
		return this.advTex.rootContainer.isVisible;
	}

	open() {
		this.advTex.rootContainer.isVisible = true;
		this.updatePointerEvents();
	}

	close() {
		this.advTex.rootContainer.isVisible = false;
		this.updatePointerEvents();
	}

	private updatePointerEvents() {
		const layer = this.advTex.getContext().canvas as HTMLCanvasElement;
		layer.style.pointerEvents = this.isOpen() ? 'auto' : 'none';
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
		buttonBack?.onPointerUpObservable.add(() => this.close());

		const buttonReset = this.advTex.getControlByName(
			'ButtonReset',
		) as GUI.Button;
		buttonReset?.onPointerUpObservable.add(() => this.resetKeybinds());

		const keyButtons: Record<keyof KeyBindings, GUI.Button> = {
			forward: this.advTex.getControlByName('Key_Forward') as GUI.Button,
			backward: this.advTex.getControlByName(
				'Key_Backward',
			) as GUI.Button,
			right: this.advTex.getControlByName('Key_Right') as GUI.Button,
			left: this.advTex.getControlByName('Key_Left') as GUI.Button,
			jump: this.advTex.getControlByName('Key_Jump') as GUI.Button,
		};
		for (const action of Object.keys(keyButtons) as (keyof KeyBindings)[]) {
			const button = keyButtons[action];
			if (!button) continue;

			this.setButtonLabel(button, this.keybinds[action]);
			button.onPointerUpObservable.add(() =>
				this.beginRebind(action, button),
			);
		}
		document.addEventListener('keydown', this.boundKeyDown);
	}

	private beginRebind(action: keyof KeyBindings, button: GUI.Button) {
		this.awaitingBindFor = action;
		this.setButtonLabel(button, '...');
	}

	private handleRebindKeyDown(e: KeyboardEvent) {
		if (!this.awaitingBindFor) return;
		e.preventDefault();

		const action = this.awaitingBindFor;
		const key = e.key.toLowerCase();

		if (key === 'escape') {
			this.cancelRebind(action);
			return;
		}

		if (key === 'p') {
			this.showRebindError(action);
			return;
		}

		this.keybinds[action] = key;
		this.awaitingBindFor = null;

		const controlName = `Key_${action.charAt(0).toUpperCase()}${action.slice(1)}`;
		const button = this.advTex.getControlByName(controlName) as GUI.Button;
		if (button) this.setButtonLabel(button, key);
	}

	private setButtonLabel(button: GUI.Button, label: string) {
		const textBlock =
			button.textBlock ?? (button.children[0] as GUI.TextBlock);
		if (textBlock)
			textBlock.text = label === ' ' ? 'SPACE' : label.toUpperCase();
	}

	private resetKeybinds() {
		const defaults: KeyBindings = {
			forward: 'w',
			backward: 's',
			left: 'a',
			right: 'd',
			jump: ' ',
		};
		Object.assign(this.keybinds, defaults);
		for (const action of Object.keys(defaults) as (keyof KeyBindings)[]) {
			const controlName = `Key_${action.charAt(0).toUpperCase()}${action.slice(1)}`;
			const button = this.advTex.getControlByName(
				controlName,
			) as GUI.Button;
			if (button) this.setButtonLabel(button, defaults[action]);
		}
	}

	private cancelRebind(action: keyof KeyBindings) {
		this.awaitingBindFor = null;

		const controlName = `Key_${action.charAt(0).toUpperCase()}${action.slice(1)}`;
		const button = this.advTex.getControlByName(controlName) as GUI.Button;
		if (button) this.setButtonLabel(button, this.keybinds[action]);
	}

	private showRebindError(action: keyof KeyBindings) {
		const controlName = `Key_${action.charAt(0).toUpperCase()}${action.slice(1)}`;
		const button = this.advTex.getControlByName(controlName) as GUI.Button;
		if (!button) return;

		this.setButtonLabel(button, 'RESERVED');

		setTimeout(() => {
			if (this.awaitingBindFor === action) {
				this.setButtonLabel(button, '...');
			}
		}, 700);
	}

	private boundKeyDown = (e: KeyboardEvent) => this.handleRebindKeyDown(e);
}
