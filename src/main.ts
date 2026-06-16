import { GameScene } from './scenes/GameScene';
import * as BABYLON from '@babylonjs/core';
import './global.css';

function mainEntryPoint() {
	const canvas = document.getElementById('game') as HTMLCanvasElement;

	const engine = new BABYLON.Engine(canvas);
	const scene = new GameScene(engine);

	engine.runRenderLoop(() => {
		scene.getScene().render();
	});
	window.addEventListener('resize', () => {
		engine.resize();
	});
}

mainEntryPoint();
