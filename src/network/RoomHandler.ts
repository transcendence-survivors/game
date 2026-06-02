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
import type { LocalPredictor } from './LocalPredictor';
import type { LatencyPanel } from '../ui/LatencyPanel';

/** Minimal structural type for what the views need to read from a player. */
interface SyncedPlayer {
	x: number;
	y: number;
	z: number;
	latencyMs: number;
	/** Latest input seq the server applied — drives local-player reconciliation. */
	lastSeq: number;
}

/**
 * Structural mirror of colyseus' `Collection` interface (it isn't re-exported
 * from the `colyseus.js` entry point). Matching its shape is enough for
 * `getStateCallbacks`' `CallbackProxy` conditional to resolve this as a
 * collection and expose `.onAdd` / `.onRemove`.
 */
interface PlayerCollection {
	[Symbol.iterator](): IterableIterator<SyncedPlayer>;
	forEach(callback: (value: SyncedPlayer, key: string) => void): void;
	entries(): IterableIterator<[string, SyncedPlayer]>;
}

/**
 * Client-side view of the synced room state.
 *
 * The client never re-declares the server's `@colyseus/schema` classes, so we
 * describe the shape structurally. Typing `players` as a collection is what
 * makes the proxy resolve `.onAdd` / `.onRemove` on it and `.listen` /
 * `.onChange` on the root — no `as never` casts needed.
 */
interface GameStateView {
	tick: number;
	players: PlayerCollection;
}

export class RoomHandler {
	private readonly room: Room;
	private readonly registry: PlayerRegistry;
	private readonly panel: LatencyPanel;
	private readonly input: InputManager;
	private readonly predictor: LocalPredictor;
	private readonly sendIntervalMs: number;
	private sendTimer: ReturnType<typeof setInterval> | null = null;

	constructor(
		room: Room,
		registry: PlayerRegistry,
		panel: LatencyPanel,
		input: InputManager,
		predictor: LocalPredictor,
		sendRateHz: number,
	) {
		this.room = room;
		this.registry = registry;
		this.panel = panel;
		this.input = input;
		this.predictor = predictor;
		this.sendIntervalMs = 1000 / sendRateHz;
	}

	/** Start mirroring server state to the scene and shipping inputs to the server. */
	attach(): void {
		const $ = getStateCallbacks(this.room);
		const state = this.room.state as GameStateView;

		// Initial paint — the schema is already populated when `attach` runs.
		this.panel.setServerTick(state.tick);

		// `listen` fires whenever a specific top-level field changes. Cheaper
		// than `onChange` here because we only care about `tick`.
		$(state).listen('tick', (val: number) => {
			this.panel.setServerTick(val);
		});

		// `$(state).players` exposes per-collection + per-item callbacks.
		$(state).players.onAdd((player: SyncedPlayer, sessionId: string) => {
			const isLocal = sessionId === this.room.sessionId;
			this.registry.spawn(sessionId, player.x, player.y, player.z);
			this.panel.add(sessionId, player.latencyMs);
			if (isLocal) {
				this.predictor.init(player.x, player.y, player.z);
			}
			$(player).onChange(() => {
				if (isLocal) {
					// Authoritative snapshot for our own cube: reconcile prediction
					// instead of snapping the target back to the (round-trip-old)
					// server position, which would cause rubber-banding.
					const p = this.predictor.reconcile(player.x, player.y, player.z, player.lastSeq);
					this.registry.update(sessionId, p.x, p.y, p.z);
				} else {
					this.registry.update(sessionId, player.x, player.y, player.z);
				}
				this.panel.update(sessionId, player.latencyMs);
			});
		});

		$(state).players.onRemove((_player: SyncedPlayer, sessionId: string) => {
			this.registry.despawn(sessionId);
			this.panel.remove(sessionId);
		});

		this.sendTimer = setInterval(() => {
			const cmd = this.input.snapshot();
			this.room.send(ClientMessage.Input, cmd);
			// Predict the local cube forward immediately so input feels instant;
			// the next snapshot's onChange will reconcile it.
			if (this.predictor.isReady) {
				const p = this.predictor.applyInput(cmd);
				this.registry.update(this.room.sessionId, p.x, p.y, p.z);
			}
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
