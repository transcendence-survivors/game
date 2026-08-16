import * as BABYLON from '@babylonjs/core';
import * as COLYSEUS from '@colyseus/sdk';
import type { CombatEntity, GameState } from '../../../shared-package';
import { CombatAssetLibrary } from './CombatAssetLibrary';
import type { CombatEntityView } from './CombatEntityView';
import { CombatViewFactory } from './CombatViewFactory';
import { AsyncViewRegistry } from './AsyncViewRegistry';
import type { WeaponAttachmentRenderer } from './WeaponAttachmentRenderer';
import { CombatHitboxDebugRenderer } from './CombatHitboxDebugRenderer';

export class CombatRenderer {
	private readonly assets: CombatAssetLibrary;
	private readonly factory: CombatViewFactory;
	private readonly views = new AsyncViewRegistry<CombatEntityView>();
	private readonly observer: BABYLON.Observer<BABYLON.Scene>;
	private readonly scene: BABYLON.Scene;
	private readonly room: COLYSEUS.Room<GameState>;
	private readonly weaponAttachments: WeaponAttachmentRenderer;
	private readonly hitboxes: CombatHitboxDebugRenderer;

	constructor(
		scene: BABYLON.Scene,
		room: COLYSEUS.Room<GameState>,
		assets: CombatAssetLibrary,
		weaponAttachments: WeaponAttachmentRenderer,
	) {
		this.scene = scene;
		this.room = room;
		this.assets = assets;
		this.weaponAttachments = weaponAttachments;
		this.factory = new CombatViewFactory(scene, this.assets);
		this.hitboxes = new CombatHitboxDebugRenderer(scene, room.state);
		this.observer = scene.onBeforeRenderObservable.add(() => this.update());
	}

	listen(): void {
		const callbacks = COLYSEUS.Callbacks.get(this.room);
		callbacks.onAdd(
			'combatEntities',
			(entity, id) => void this.add(entity, id),
		);
		callbacks.onRemove('combatEntities', (_entity, id) => this.remove(id));
	}

	dispose(): void {
		this.scene.onBeforeRenderObservable.remove(this.observer);
		this.views.dispose();
		this.factory.dispose();
		this.hitboxes.dispose();
	}

	setHitboxesVisible(visible: boolean): void {
		this.hitboxes.setVisible(visible);
	}

	private async add(entity: CombatEntity, id: string): Promise<void> {
		try {
			this.weaponAttachments.playAttack(
				entity.ownerSessionId,
				entity.weaponKind,
			);
			await this.views.add(id, () => this.factory.create(entity, id));
		} catch (error) {
			console.error(
				`failed to render combat entity '${entity.kind}'`,
				error,
			);
		}
	}

	private remove(id: string): void {
		this.views.remove(id);
	}

	private update(): void {
		this.hitboxes.update();
		const deltaTimeS = this.scene.getEngine().getDeltaTime() / 1000;
		this.views.forEach((view, id) => {
			const entity = this.room.state.combatEntities.get(id);
			if (!entity) return;
			view.synchronize(entity);
			view.update(deltaTimeS, this.room.state.combatTimeS);
		});
	}
}
