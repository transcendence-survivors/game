import { GameScene } from './scenes/GameScene';
import * as BABYLON from '@babylonjs/core';
import './global.css';
import { MainMenuScene } from './scenes/MainMenuScene';

function mainEntryPoint() {
	const canvas = document.getElementById('game') as HTMLCanvasElement;

	const engine = new BABYLON.Engine(canvas);
	// const scene = new GameScene(engine);
	const scene = new MainMenuScene(engine, (action) => {
		if (action === 'play') console.log('Play button pressed');
		if (action === 'settings') console.log('Settings button pressed');
	});

	engine.runRenderLoop(() => {
		scene.render();
	});
	window.addEventListener('resize', () => {
		engine.resize();
	});
}

mainEntryPoint();
