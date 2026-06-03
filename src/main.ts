/**
 * @file Browser entry point — the screen-flow controller.
 *
 * Flow:
 *   Menu  ──create/join──▶  Lobby  ──phase: playing──▶  In-game (Babylon)
 *     ▲                       │
 *     └──────leave / kicked───┘
 *
 * The Babylon engine boots immediately on a lightweight {@link createMenuScene |
 * menu scene} and a fullscreen GUI texture carries the menu + lobby (same
 * rendering pipeline as the in-game LatencyPanel). Only when the room's phase
 * flips to `playing` do we swap the engine onto the real game scene (see
 * `game/InGame.ts`), which disposes the menu scene and its GUI automatically.
 *
 * Anything that fails during boot is rendered into the page as a fallback
 * message — silent failures behind a black canvas are the worst dev experience.
 */

import './global.css';

import type { Room } from 'colyseus.js';
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';

import { loadConfig } from './core/ConfigLoader';
import { GameEngine } from './core/Engine';
import { startInGame } from './game/InGame';
import { NetworkClient } from './network/NetworkClient';
import { createMenuScene } from './scenes/MenuScene';
import { LobbyScreen } from './ui/LobbyScreen';
import { MenuScreen } from './ui/MenuScreen';

function bootstrap(): void {
	const canvas = document.querySelector<HTMLCanvasElement>('#game');
	if (canvas === null) {
		throw new Error('[main] #game canvas not found in index.html');
	}

	const config = loadConfig();
	console.log(`[client] config — endpoint=${config.network.endpoint}`);

	// Engine + menu scene + fullscreen GUI, all live for the menu/lobby phase.
	const engine = new GameEngine(canvas);
	const menuScene = createMenuScene(engine, config.render);
	engine.setScene(menuScene);
	engine.start();
	const ui = AdvancedDynamicTexture.CreateFullscreenUI('menu-ui', true, menuScene);

	const network = new NetworkClient(config.network.endpoint);

	// Holds whatever needs tearing down for the *current* screen so a transition
	// (or tab close) never leaks listeners or room subscriptions.
	let teardown: (() => void) | null = null;
	const clearTeardown = (): void => {
		teardown?.();
		teardown = null;
	};

	const showMenu = (): void => {
		clearTeardown();
		const menu = new MenuScreen({
			ui,
			network,
			config: config.lobby,
			onEnterRoom: (room) => showLobby(room),
		});
		menu.mount();
		teardown = () => menu.dispose();
	};

	const showLobby = (room: Room): void => {
		clearTeardown();
		const lobby = new LobbyScreen({
			ui,
			room,
			onStart: (started) => showGame(started),
			onKicked: (reason) => {
				console.log(`[client] kicked: ${reason}`);
				void room.leave();
				showMenu();
			},
			onLeave: () => {
				void room.leave();
				showMenu();
			},
		});
		lobby.mount();
		teardown = () => lobby.dispose();
	};

	const showGame = (room: Room): void => {
		// Remove the lobby GUI (keep the room — it's now the game's transport),
		// then boot the 3D game, which swaps the engine onto the game scene.
		clearTeardown();
		teardown = startInGame(engine, room, config);
	};

	showMenu();

	// Cleanup on hot-reload (Vite) or tab close.
	window.addEventListener('beforeunload', () => {
		clearTeardown();
		engine.dispose();
	});
}

try {
	bootstrap();
} catch (err: unknown) {
	const message = err instanceof Error ? err.message : String(err);
	console.error('[client] bootstrap failed', err);
	document.body.insertAdjacentHTML(
		'beforeend',
		`<pre style="position:fixed;inset:1rem;background:#000c;color:#f87171;padding:1rem;font:14px monospace;white-space:pre-wrap;z-index:9999">Boot error: ${message}</pre>`,
	);
}
