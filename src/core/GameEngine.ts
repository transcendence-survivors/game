import {
	Engine, HemisphericLight, Scene, UniversalCamera, Vector3,
} from '@babylonjs/core';
import '@babylonjs/core/Debug/debugLayer';
import '@babylonjs/inspector';

export class GameEngine {
	private readonly _canvas: HTMLCanvasElement;
	private readonly _engine: Engine;
	private readonly _scene: Scene;

	constructor(canvas: HTMLCanvasElement) {
		this._canvas = canvas;
		this._canvas.width = window.innerWidth;
		this._canvas.height = window.innerHeight;

		this._engine = new Engine(this._canvas, true);
		this._scene = new Scene(this._engine);

		new HemisphericLight('light1', new Vector3(1, 1, 0), this._scene);

		const placeholderCam = new UniversalCamera('placeholderCam', new Vector3(0, 0, 0), this._scene);
		this._scene.activeCamera = placeholderCam;
	}

	get canvas(): HTMLCanvasElement {
		return this._canvas;
	}

	get engine(): Engine {
		return this._engine;
	}

	get scene(): Scene {
		return this._scene;
	}

	getFps(): number {
		return this._engine.getFps();
	}

	getDeltaTime(): number {
		return this._engine.getDeltaTime();
	}

	resize(): void {
		this._canvas.width = window.innerWidth;
		this._canvas.height = window.innerHeight;
		this._engine.resize();
	}

	run(onBeforeRender: () => void): void {
		this._scene.onBeforeRenderObservable.add(onBeforeRender);
		this._engine.runRenderLoop(() => this._scene.render());
	}

	toggleDebugLayer(): void {
		if (this._scene.debugLayer.isVisible()) this._scene.debugLayer.hide();
		else this._scene.debugLayer.show();
	}
}
