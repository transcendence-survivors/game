import * as BABYLON from '@babylonjs/core';
import * as COLYSEUS from '@colyseus/sdk';
import type { CombatEntity, GameState } from '../../../shared-package';
import { CombatAssetLibrary } from './CombatAssetLibrary';
import type { CombatEntityView } from './CombatEntityView';
import { CombatViewFactory } from './CombatViewFactory';

export class CombatRenderer {
	private readonly assets: CombatAssetLibrary;
	private readonly factory: CombatViewFactory;
	private readonly views = new Map<string, CombatEntityView>();
	private readonly pending = new Map<string, object>();
	private readonly observer: BABYLON.Observer<BABYLON.Scene>;
	private readonly scene: BABYLON.Scene;
	private readonly room: COLYSEUS.Room<GameState>;
	private disposed = false;

	constructor(
		scene: BABYLON.Scene,
		room: COLYSEUS.Room<GameState>,
		assets: CombatAssetLibrary,
	) {
		this.scene = scene;
		this.room = room;
		this.assets = assets;
		this.factory = new CombatViewFactory(scene, this.assets);
		this.observer = scene.onBeforeRenderObservable.add(() => this.update());
	}

	listen(): void {
		const callbacks = COLYSEUS.Callbacks.get(this.room);
		callbacks.onAdd('combatEntities', (entity, id) => void this.add(entity, id));
		callbacks.onRemove('combatEntities', (_entity, id) => this.remove(id));
	}

	dispose(): void {
		this.disposed = true;
		this.scene.onBeforeRenderObservable.remove(this.observer);
		this.pending.clear();
		this.views.forEach((view) => view.dispose());
		this.views.clear();
		this.factory.dispose();
	}

	private async add(entity: CombatEntity, id: string): Promise<void> {
		const token = {};
		this.pending.set(id, token);
		try {
			const view = await this.factory.create(entity, id);
			if (this.disposed || this.pending.get(id) !== token) {
				view.dispose();
				return;
			}
			this.pending.delete(id);
			this.views.get(id)?.dispose();
			this.views.set(id, view);
		} catch (error) {
			if (this.pending.get(id) === token) this.pending.delete(id);
			console.error(`failed to render combat entity '${entity.kind}'`, error);
		}
	}

	private remove(id: string): void {
		this.pending.delete(id);
		this.views.get(id)?.dispose();
		this.views.delete(id);
	}

	private update(): void {
		const deltaTimeS = this.scene.getEngine().getDeltaTime() / 1000;
		for (const [id, view] of this.views) {
			const entity = this.room.state.combatEntities.get(id);
			if (!entity) continue;
			view.synchronize(entity);
			view.update(deltaTimeS, this.room.state.combatTimeS);
		}
	}
}
