import { type Engine } from '@babylonjs/core';
import { MainMenuScene, type MenuAction } from './scenes/MainMenuScene';
import { GameScene } from './scenes/GameScene';
import { LobbyScene } from './LobbyScene';

export interface ManagedScene {
	render(): void;
	dispose(): void;
	ready: Promise<void>;
}

export class SceneManager {
	private static engine: Engine;
	private static currentScene: ManagedScene;

	constructor() {}

	static init(engine: Engine) {
		SceneManager.engine = engine;
	}

	static getEngine() {
		return this.engine;
	}

	static getCurrentScene() {
		return this.currentScene;
	}

	static toMainMenu() {
		return SceneManager.set(
			new MainMenuScene(SceneManager.engine, (action: MenuAction) => {
				if (action === 'play') SceneManager.toGame();
				if (action === 'multiplayer') SceneManager.toLobby();
			}),
		);
	}

	static toGame() {
		return SceneManager.set(new GameScene(this.engine));
	}

	static toLobby() {
		return SceneManager.set(new LobbyScene(this.engine));
	}

	static async set(newScene: ManagedScene) {
		try {
			await newScene.ready;
		} catch (error) {
			console.error('Scene failed to initialize');
			newScene.dispose();
			return;
		}
		const previousScene = SceneManager.currentScene;
		SceneManager.currentScene = newScene;
		if (previousScene) previousScene.dispose();
	}

	static start() {
		this.engine.runRenderLoop(() => {
			this.currentScene.render();
		});
	}

	static stop() {
		this.engine.stopRenderLoop();
	}
}
