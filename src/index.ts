import * as BABYLON from '@babylonjs/core';
import { SceneManager } from './SceneManager';

let engine: BABYLON.Engine | null = null;
let handleResize: (() => void) | null = null;

export async function initGame(canvas: HTMLCanvasElement) {
	// Preserve native antialiasing for the default visual profile. The scene
	// keeps its batched/culling optimizations independently of MSAA.
	engine = new BABYLON.Engine(canvas, true);
	SceneManager.init(engine);
	await SceneManager.toMainMenu();
	SceneManager.start();

	handleResize = () => engine?.resize();
	window.addEventListener('resize', handleResize);
}

export async function destroyGame() {
	SceneManager.stop();
	if (handleResize) {
		window.removeEventListener('resize', handleResize);
		handleResize = null;
	}
	engine?.dispose();
	engine = null;
}
