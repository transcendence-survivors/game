/**
 * @file Owns the set of currently-spawned {@link PlayerEntity}s, keyed by
 * sessionId. The single source of truth for "which cubes exist on screen".
 *
 * The {@link RoomHandler} drives this registry: every time the server adds,
 * removes or updates a player in the synced state, the registry mirrors the
 * change in the Babylon scene.
 *
 * Snapshots from the server only update *target* positions; a single
 * scene observer drives the per-frame interpolation on every entity. One
 * observer for all entities keeps the hot path tight.
 */

import type { Observer } from '@babylonjs/core/Misc/observable';
import type { Scene } from '@babylonjs/core/scene';
import type { RenderConfig } from '../core/ConfigLoader';
import { PlayerEntity } from './PlayerEntity';

export class PlayerRegistry {
	private readonly scene: Scene;
	private readonly config: RenderConfig;
	private readonly localSessionId: string;
	private readonly entities = new Map<string, PlayerEntity>();
	private renderObserver: Observer<Scene> | null = null;

	constructor(scene: Scene, config: RenderConfig, localSessionId: string) {
		this.scene = scene;
		this.config = config;
		this.localSessionId = localSessionId;
		this.renderObserver = scene.onBeforeRenderObservable.add(() => this.interpolate());
	}

	/**
	 * Create and add a {@link PlayerEntity} for the given session id.
	 *
	 * @returns the created entity, or the existing one if already spawned —
	 *   this keeps the registry idempotent against duplicate `onAdd` callbacks.
	 */
	spawn(id: string, x: number, y: number, z: number): PlayerEntity {
		const existing = this.entities.get(id);
		if (existing !== undefined) {
			existing.snapTo(x, y, z);
			return existing;
		}
		const color = id === this.localSessionId ? this.config.localPlayerColor : this.config.remotePlayerColor;
		const entity = new PlayerEntity(id, this.scene, color, this.config.interpRate);
		entity.snapTo(x, y, z);
		this.entities.set(id, entity);
		return entity;
	}

	/** Push a new authoritative target onto an existing entity. No-op if unknown. */
	update(id: string, x: number, y: number, z: number): void {
		this.entities.get(id)?.setTarget(x, y, z);
	}

	/** Remove the entity from the scene and forget it. No-op if unknown. */
	despawn(id: string): void {
		const entity = this.entities.get(id);
		if (entity === undefined) {
			return;
		}
		entity.dispose();
		this.entities.delete(id);
	}

	/** Detach the render observer. Call when tearing down the scene. */
	dispose(): void {
		if (this.renderObserver !== null) {
			this.scene.onBeforeRenderObservable.remove(this.renderObserver);
			this.renderObserver = null;
		}
		for (const entity of this.entities.values()) {
			entity.dispose();
		}
		this.entities.clear();
	}

	private interpolate(): void {
		// Babylon's deltaTime is in ms — convert once per frame.
		const dtSec = this.scene.getEngine().getDeltaTime() / 1000;
		for (const entity of this.entities.values()) {
			entity.tickInterpolation(dtSec);
		}
	}
}
