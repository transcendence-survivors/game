import { type Engine } from '@babylonjs/core';
import { MainMenuScene } from './scenes/MainMenuScene';
import { GameScene } from './scenes/GameScene';
import { LobbyScene } from './scenes/LobbyScene';
import * as COLYSEUS from '@colyseus/sdk';
import type { GameState } from '@transcendence/game-shared';

export interface ManagedScene {
	render(): void;
	dispose(): void;
	ready: Promise<void>;
}

export class SceneManager {
	private static engine: Engine;
	private static currentScene: ManagedScene | undefined;
	private static transitionSequence = 0;

	static init(engine: Engine) {
		SceneManager.engine = engine;
	}

	static toMainMenu() {
		return SceneManager.set(new MainMenuScene(SceneManager.engine));
	}

	static toGame(room: COLYSEUS.Room<GameState>) {
		return SceneManager.set(new GameScene(this.engine, room));
	}

	static toLobby() {
		return SceneManager.set(new LobbyScene(this.engine));
	}

	static async set(newScene: ManagedScene) {
		const transition = ++SceneManager.transitionSequence;
		try {
			await newScene.ready;
		} catch (error) {
			if (transition === SceneManager.transitionSequence)
				console.error('Scene failed to initialize', error);
			newScene.dispose();
			return;
		}
		if (transition !== SceneManager.transitionSequence) {
			newScene.dispose();
			return;
		}
		const previousScene = SceneManager.currentScene;
		SceneManager.currentScene = newScene;
		if (previousScene) previousScene.dispose();
	}

	static start() {
		this.engine.runRenderLoop(() => {
			this.currentScene?.render();
		});
	}

	static stop() {
		SceneManager.transitionSequence++;
		this.engine.stopRenderLoop();
		this.currentScene?.dispose();
		this.currentScene = undefined;
	}
}
