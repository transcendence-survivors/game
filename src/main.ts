import * as BABYLON from '@babylonjs/core';
import './global.css';
import { SceneManager } from './SceneManager';

async function mainEntryPoint() {
	const canvas = document.getElementById('game') as HTMLCanvasElement;

	const engine = new BABYLON.Engine(canvas);
	SceneManager.init(engine);
	await SceneManager.toMainMenu();
	SceneManager.start();
	window.addEventListener('resize', () => {
		engine.resize();
	});
}

await mainEntryPoint();
