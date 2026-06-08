import { Engine } from '@babylonjs/core/Engines/engine';
import type { Scene } from '@babylonjs/core/scene';

export class GameEngine {
	private readonly engine: Engine;
	private readonly canvas: HTMLCanvasElement;
	private currentScene: Scene | null = null;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.engine = new Engine(canvas, true, {
			preserveDrawingBuffer: true,
			stencil: true,
		});
		window.addEventListener('resize', this.onResize);
	}

	setScene(scene: Scene): void {
		if (this.currentScene !== null) {
			this.currentScene.dispose();
		}
		this.currentScene = scene;
	}

	start(): void {
		this.engine.runRenderLoop(() => {
			if (this.currentScene !== null) {
				this.currentScene.render();
			}
		});
	}

	dispose(): void {
		window.removeEventListener('resize', this.onResize);
		this.currentScene?.dispose();
		this.engine.dispose();
	}

	get raw(): Engine {
		return this.engine;
	}

	get canvasElement(): HTMLCanvasElement {
		return this.canvas;
	}

	private readonly onResize = (): void => {
		this.engine.resize();
	};
}
