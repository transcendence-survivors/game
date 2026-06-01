/**
 * @file Wires a connected Colyseus `Room` to the local game view.
 *
 * Responsibilities:
 * - Translate server state changes (`players.onAdd/onRemove`, per-player
 *   `onChange`) into calls on the {@link PlayerRegistry} (3D scene) and the
 *   {@link LatencyPanel} (in-scene overlay).
 * - Mirror the global server tick into the panel.
 * - Drive a fixed-rate send loop that ships the latest {@link InputCommand}
 *   from the {@link InputManager} to the server via {@link ClientMessage.Input}.
 *
 * The handler owns no rendering or input logic itself — it is the seam
 * between transport and gameplay view.
 */

import type { Room } from 'colyseus.js';
import { getStateCallbacks } from 'colyseus.js';
import { ClientMessage } from '@transcendence/game-shared';

import type { InputManager } from '../input/InputManager';
import type { PlayerRegistry } from '../entities/PlayerRegistry';
import type { LatencyPanel } from '../ui/LatencyPanel';

/** Minimal structural type for what the views need to read from a player. */
interface SyncedPlayer {
	x: number;
	y: number;
	z: number;
	latencyMs: number;
}

export class RoomHandler {
	private readonly room: Room;
	private readonly registry: PlayerRegistry;
	private readonly panel: LatencyPanel;
	private readonly input: InputManager;
	private readonly sendIntervalMs: number;
	private sendTimer: ReturnType<typeof setInterval> | null = null;

	constructor(
		room: Room,
		registry: PlayerRegistry,
		panel: LatencyPanel,
		input: InputManager,
		sendRateHz: number,
	) {
		this.room = room;
		this.registry = registry;
		this.panel = panel;
		this.input = input;
		this.sendIntervalMs = 1000 / sendRateHz;
	}

	/** Start mirroring server state to the scene and shipping inputs to the server. */
	attach(): void {
		const $ = getStateCallbacks(this.room);
		const state = this.room.state as {
			players: { onAdd: unknown; onRemove: unknown };
			tick: number;
		};

		// Initial paint — the schema is already populated when `attach` runs.
		this.panel.setServerTick(state.tick);

		// `listen` fires whenever a specific top-level field changes. Cheaper
		// than `onChange` here because we only care about `tick`.
		$(state as never).listen('tick', (val: number) => {
			this.panel.setServerTick(val);
		});

		// `$(state).players` exposes per-collection + per-item callbacks.
		// The cast below is the recommended pattern when the client doesn't
		// re-declare the server schema classes (colyseus.js infers them).
		$(state as never).players.onAdd((player: SyncedPlayer, sessionId: string) => {
			this.registry.spawn(sessionId, player.x, player.y, player.z);
			this.panel.add(sessionId, player.latencyMs);
			$(player as never).onChange(() => {
				this.registry.update(sessionId, player.x, player.y, player.z);
				this.panel.update(sessionId, player.latencyMs);
			});
		});

		$(state as never).players.onRemove((_player: SyncedPlayer, sessionId: string) => {
			this.registry.despawn(sessionId);
			this.panel.remove(sessionId);
		});

		this.sendTimer = setInterval(() => {
			this.room.send(ClientMessage.Input, this.input.snapshot());
		}, this.sendIntervalMs);
	}

	/** Stop the send loop and leave the room. */
	async detach(): Promise<void> {
		if (this.sendTimer !== null) {
			clearInterval(this.sendTimer);
			this.sendTimer = null;
		}
		await this.room.leave();
	}
}
