import type { Scene } from '@babylonjs/core';
import { loadConfig, type ClientConfig } from './core/ConfigLoader';
import { GameEngine } from './core/Engine';
import { NetworkClient } from './network/NetworkClient';
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { createMenuScene } from './scenes/MenuScene';
import { MenuScreen } from './ui/MenuScreen';
import type { Room } from 'colyseus.js';
import { LobbyScreen } from './ui/LobbyScreen';
import { startInGame } from './game/InGame';

export interface DisplayState {
	mount(): void;
	dispose(): void;
}

type SceneKeys = 'menu' | 'game';

export class App {
	private currentState: DisplayState;
	private config: ClientConfig;
	private engine: GameEngine;
	private network: NetworkClient;
	private scenes: Map<SceneKeys, Scene>;
	private ui: AdvancedDynamicTexture;
	private canvas: HTMLCanvasElement;

	constructor() {
		this.canvas = this.getCanvas();
		this.config = loadConfig();
		this.engine = new GameEngine(this.canvas);
		this.scenes = new Map();
		this.scenes.set(
			'menu',
			createMenuScene(this.engine, this.config.render),
		);
		this.network = new NetworkClient(this.config.network.endpoint);
		this.ui = AdvancedDynamicTexture.CreateFullscreenUI(
			'menu-ui',
			true,
			this.scenes.get('menu'),
		);
		this.currentState = this.showMenu();
	}

	addScene(key: SceneKeys, scene: Scene) {
		this.scenes.set(key, scene);
	}

	disposeScene(key: SceneKeys) {
		this.scenes.get(key)?.dispose();
	}

	disposeAllScenes() {
		this.scenes.forEach((scene) => {
			scene.dispose();
		});
	}

	startup() {
		this.setupEvents();
		const menuScene = this.scenes.get('menu');
		if (menuScene) {
			this.engine.setScene(menuScene);
		} else {
			throw new Error('Could not find menu scene');
		}
		this.engine.start();
		this.showMenu();
	}

	private getCanvas() {
		const canvas = document.querySelector<HTMLCanvasElement>('#game');
		if (canvas === null) {
			throw new Error('[main] Game canvas not found in index.html');
		}
		return canvas;
	}

	private setupEvents() {
		window.addEventListener('beforeunload', () => {
			this.disposeAllScenes();
			this.currentState.dispose();
			this.engine.dispose();
		});
	}

	private switchState(newState: DisplayState) {
		this.currentState.dispose();
		this.currentState = newState;
		this.currentState.mount();
	}

	showMenu() {
		const menuState = new MenuScreen({
			ui: this.ui,
			network: this.network,
			config: this.config.lobby,
			onEnterRoom: (room) => this.showLobby(room),
		});
		this.switchState(menuState);
		return menuState;
	}

	showLobby(room: Room) {
		this.switchState(
			new LobbyScreen({
				ui: this.ui,
				room,
				onStart: (started) => this.showGame(started),
				onKicked: (reason) => {
					console.log(`[client] kicked: ${reason}`);
					room.leave();
					this.showMenu();
				},
				onLeave: () => {
					room.leave();
					this.showMenu();
				},
			}),
		);
	}

	showGame(room: Room) {
		this.switchState(startInGame(this.engine, room, this.config));
	}

	dispose() {
		this.currentState.dispose();
		this.engine.dispose();
	}
}
