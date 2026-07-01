import { GameScene } from './scenes/GameScene';
import * as BABYLON from '@babylonjs/core';
import './global.css';
import { MainMenuScene } from './scenes/MainMenuScene';

function mainEntryPoint() {
	const canvas = document.getElementById('game') as HTMLCanvasElement;

	// antialias + adaptToDeviceRatio (4e arg) : rend à la résolution native de
	// l'écran (fin du flou pixelisé sur écran HiDPI) et lisse les bords géométriques.
	const engine = new BABYLON.Engine(
		canvas,
		true,
		{ stencil: true, preserveDrawingBuffer: true },
		true,
	);
	let currentScene: MainMenuScene | GameScene;
	const mainMenuScene = new MainMenuScene(engine, async (action) => {
		if (action === 'play') {
			const gameScene = new GameScene(engine);
			await gameScene.ready;
			mainMenuScene.dispose();
			currentScene = gameScene;
		}
		if (action === 'settings') console.log('Settings button pressed');
	});
	currentScene = mainMenuScene;

	engine.runRenderLoop(() => {
		currentScene.render();
	});
	window.addEventListener('resize', () => {
		engine.resize();
	});
}

mainEntryPoint();
