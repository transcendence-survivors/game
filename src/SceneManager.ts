import { type Engine } from '@babylonjs/core';
import { MainMenuScene } from './scenes/MainMenuScene';
import { GameScene } from './scenes/GameScene';
import { LobbyScene } from './scenes/LobbyScene';
import * as COLYSEUS from '@colyseus/sdk';
import type { GameState } from '../../shared-package/src';
import { EndingScreen } from './EndingScreen';
import { WaitingScreen } from './WaitingScreen';

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
		return SceneManager.set(new MainMenuScene(SceneManager.engine));
	}

	static toGame(room: COLYSEUS.Room<GameState>) {
		return SceneManager.set(new GameScene(this.engine, room));
	}

	static toWaiting(room: COLYSEUS.Room<GameState>) {
		return SceneManager.set(new WaitingScreen(this.engine, room));
	}

	static toLobby() {
		return SceneManager.set(new LobbyScene(this.engine));
	}

	static toEndScreen(room: COLYSEUS.Room<GameState>) {
		return SceneManager.set(new EndingScreen(this.engine, room));
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
		this.currentScene.dispose();
	}
}
