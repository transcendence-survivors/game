/**
 * @file Thin wrapper around the Babylon `Engine` that owns the canvas, the
 * render loop and the window-resize listener.
 *
 * Keeping this isolated means {@link SceneManager} can swap scenes without
 * touching engine setup, and tests can substitute a NullEngine.
 */

import { Engine } from '@babylonjs/core/Engines/engine';
import type { Scene } from '@babylonjs/core/scene';

export class GameEngine {
	private readonly engine: Engine;
	private readonly canvas: HTMLCanvasElement;
	private currentScene: Scene | null = null;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
		window.addEventListener('resize', this.onResize);
	}

	/** Replace the currently rendered scene. The previous scene is disposed. */
	setScene(scene: Scene): void {
		if (this.currentScene !== null) {
			this.currentScene.dispose();
		}
		this.currentScene = scene;
	}

	/** Start the Babylon render loop. Idempotent — safe to call once at boot. */
	start(): void {
		this.engine.runRenderLoop(() => {
			if (this.currentScene !== null) {
				this.currentScene.render();
			}
		});
	}

	/** Tear down listeners, scene and the Babylon engine. */
	dispose(): void {
		window.removeEventListener('resize', this.onResize);
		this.currentScene?.dispose();
		this.engine.dispose();
	}

	/** Underlying Babylon engine — exposed so scenes can attach to it. */
	get raw(): Engine {
		return this.engine;
	}

	/** Canvas DOM element — exposed for input handlers. */
	get canvasElement(): HTMLCanvasElement {
		return this.canvas;
	}

	private readonly onResize = (): void => {
		this.engine.resize();
	};
}
