/**
 * @file Wires an already-joined Colyseus room to the live 3D game.
 *
 * This is the in-game half of the boot sequence, extracted from the old
 * `main.ts` so the gameplay path is unchanged: only the connection step moved
 * out (the room is now created/joined by the menu and handed in here once its
 * phase flips to `playing`).
 *
 * The Babylon engine is owned by `main.ts` (it already runs the render loop on
 * the menu scene) and passed in — this function swaps it onto the game scene,
 * which disposes the menu scene and its GUI automatically.
 *
 * Responsibilities:
 *   1. Build the game scene and swap the engine onto it.
 *   2. Wire input, hotkeys, latency tracker, panel and room handler.
 *   3. Return a teardown that disposes the game wiring and leaves the room
 *      (but NOT the engine — that lives for the app's lifetime).
 */

import type { Room } from 'colyseus.js';

import type { ClientConfig } from '../core/ConfigLoader';
import type { GameEngine } from '../core/Engine';
import { StatsSampler } from '../core/StatsSampler';
import { PlayerRegistry } from '../entities/PlayerRegistry';
import { InputManager } from '../input/InputManager';
import { UiHotkeys } from '../input/UiHotkeys';
import { LatencyTracker } from '../network/LatencyTracker';
import { LocalPredictor } from '../network/LocalPredictor';
import { RoomHandler } from '../network/RoomHandler';
import { createGameScene } from '../scenes/GameScene';
import { LatencyPanel } from '../ui/LatencyPanel';

/** Tears down everything {@link startInGame} created and leaves the room. */
export type InGameTeardown = () => void;

/**
 * Boot the live game on an already-joined room.
 *
 * @param engine - The shared {@link GameEngine} (render loop already running).
 * @param room - The Colyseus room, already joined and in the `playing` phase.
 * @param config - The resolved client config.
 * @returns a teardown function — call it on shutdown / leaving the game.
 */
export function startInGame(engine: GameEngine, room: Room, config: ClientConfig): InGameTeardown {
	// Swapping the scene disposes the previous (menu) scene and its GUI.
	const scene = createGameScene(engine, config.render);
	engine.setScene(scene);

	const registry = new PlayerRegistry(scene, config.render, room.sessionId);
	const panel = new LatencyPanel(scene, room.sessionId);

	const input = new InputManager(config.controls);
	input.attach();

	const hotkeys = new UiHotkeys({ togglePanel: config.controls.togglePanel }, () => panel.toggle());
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

	// The engine's render loop is already running (started on the menu scene) —
	// no engine.start() here. Teardown disposes the game wiring but leaves the
	// engine alive; `main.ts` disposes the engine on tab close.
	return () => {
		stats.detach();
		latency.detach();
		void handler.detach();
		hotkeys.detach();
		input.detach();
		registry.dispose();
		panel.dispose();
	};
}
