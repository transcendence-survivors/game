/**
 * @file Browser entry point.
 *
 * Boot sequence:
 *   1. Load configs (controls, render, network).
 *   2. Build the Babylon engine + game scene.
 *   3. Connect to the Colyseus server, join the canonical room.
 *   4. Wire input, hotkeys, latency tracker, panel and room handler.
 *   5. Start the render loop.
 *
 * Anything that fails during boot is rendered into the page as a fallback
 * message — silent failures behind a black canvas are the worst dev experience.
 */

import './global.css';

import { loadConfig } from './core/ConfigLoader';
import { GameEngine } from './core/Engine';
import { StatsSampler } from './core/StatsSampler';
import { PlayerRegistry } from './entities/PlayerRegistry';
import { InputManager } from './input/InputManager';
import { UiHotkeys } from './input/UiHotkeys';
import { LatencyTracker } from './network/LatencyTracker';
import { LocalPredictor } from './network/LocalPredictor';
import { NetworkClient } from './network/NetworkClient';
import { RoomHandler } from './network/RoomHandler';
import { createGameScene } from './scenes/GameScene';
import { LatencyPanel } from './ui/LatencyPanel';

async function bootstrap(): Promise<void> {
	const canvas = document.querySelector<HTMLCanvasElement>('#game');
	if (canvas === null) {
		throw new Error('[main] #game canvas not found in index.html');
	}

	const config = loadConfig();
	console.log(
		`[client] config — endpoint=${config.network.endpoint}, sendRate=${config.network.sendRateHz}Hz, ping=${config.network.pingIntervalMs}ms`,
	);

	const engine = new GameEngine(canvas);
	const scene = createGameScene(engine, config.render);
	engine.setScene(scene);

	const network = new NetworkClient(config.network.endpoint);
	const room = await network.joinGame();
	console.log(`[client] joined room "${room.name}" as ${room.sessionId}`);

	const registry = new PlayerRegistry(scene, config.render, room.sessionId);
	const panel = new LatencyPanel(scene, room.sessionId);

	const input = new InputManager(config.controls);
	input.attach();

	const hotkeys = new UiHotkeys({ togglePanel: config.controls.togglePanel }, () =>
		panel.toggle(),
	);
	hotkeys.attach();

	const latency = new LatencyTracker(room, config.network.pingIntervalMs);
	latency.attach();

	const predictor = new LocalPredictor(config.physics.moveSpeed, config.network.sendRateHz);
	const handler = new RoomHandler(room, registry, panel, input, predictor, config.network.sendRateHz);
	handler.attach();

	const stats = new StatsSampler(
		engine,
		() => (room.state as { tick: number }).tick,
		{
			onFps: (fps) => panel.setClientFps(fps),
			onTps: (tps) => panel.setServerTps(tps),
		},
		{ intervalMs: 500 },
	);
	stats.attach();

	engine.start();

	// Cleanup on hot-reload (Vite) or tab close.
	window.addEventListener('beforeunload', () => {
		stats.detach();
		latency.detach();
		void handler.detach();
		hotkeys.detach();
		input.detach();
		registry.dispose();
		panel.dispose();
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
