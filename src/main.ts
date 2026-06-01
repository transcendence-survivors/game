/**
 * @file Browser entry point.
 *
 * Boot sequence:
 *   1. Load configs (controls, render, network).
 *   2. Build the Babylon engine + game scene.
 *   3. Connect to the Colyseus server, join the canonical room.
 *   4. Wire the input manager and room handler.
 *   5. Start the render loop.
 *
 * Anything that fails during boot is rendered into the page as a fallback
 * message — silent failures behind a black canvas are the worst dev experience.
 */

import './global.css';

import { loadConfig } from './core/ConfigLoader';
import { GameEngine } from './core/Engine';
import { PlayerRegistry } from './entities/PlayerRegistry';
import { InputManager } from './input/InputManager';
import { NetworkClient } from './network/NetworkClient';
import { RoomHandler } from './network/RoomHandler';
import { createGameScene } from './scenes/GameScene';

async function bootstrap(): Promise<void> {
	const canvas = document.querySelector<HTMLCanvasElement>('#game');
	if (canvas === null) {
		throw new Error('[main] #game canvas not found in index.html');
	}

	const config = loadConfig();
	console.log(
		`[client] config — endpoint=${config.network.endpoint}, sendRate=${config.network.sendRateHz}Hz`,
	);

	const engine = new GameEngine(canvas);
	const scene = createGameScene(engine, config.render);
	engine.setScene(scene);

	const network = new NetworkClient(config.network.endpoint);
	const room = await network.joinGame();
	console.log(`[client] joined room "${room.name}" as ${room.sessionId}`);

	const registry = new PlayerRegistry(scene, config.render, room.sessionId);
	const input = new InputManager(config.controls);
	input.attach();

	const handler = new RoomHandler(room, registry, input, config.network.sendRateHz);
	handler.attach();

	engine.start();

	// Cleanup on hot-reload (Vite) or tab close.
	window.addEventListener('beforeunload', () => {
		void handler.detach();
		input.detach();
		engine.dispose();
	});
}

bootstrap().catch((err: unknown) => {
	const message = err instanceof Error ? err.message : String(err);
	console.error('[client] bootstrap failed', err);
	document.body.insertAdjacentHTML(
		'beforeend',
		`<pre style="position:fixed;inset:1rem;background:#000c;color:#f87171;padding:1rem;font:14px monospace;white-space:pre-wrap;z-index:9999">Boot error: ${message}</pre>`,
	);
});
