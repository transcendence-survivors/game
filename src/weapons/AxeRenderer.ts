import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import * as COLYSEUS from '@colyseus/sdk';
import {
	type CombatEntity,
	type GameState,
} from '../../../shared-package';
import { models } from '../assets/models';
import type { MapGenerator } from '../map/MapGenerator';

interface AxeView {
	root: BABYLON.TransformNode;
	entity: CombatEntity;
	removed: boolean;
}

export class AxeRenderer {
	private readonly axes = new Map<string, AxeView>();
	private readonly observer: BABYLON.Observer<BABYLON.Scene>;
	private readonly scene: BABYLON.Scene;
	private readonly room: COLYSEUS.Room<GameState>;
	private readonly map: MapGenerator;

	constructor(
		scene: BABYLON.Scene,
		room: COLYSEUS.Room<GameState>,
		map: MapGenerator,
	) {
		this.scene = scene;
		this.room = room;
		this.map = map;
		this.observer = scene.onBeforeRenderObservable.add(() => this.animate());
	}

	listen(): void {
		const callbacks = COLYSEUS.Callbacks.get(this.room);
		callbacks.onAdd('combatEntities', (entity, entityId) => {
			if (entity.kind !== 'axe') return;
			void this.add(entity, entityId);
		});
		callbacks.onRemove('combatEntities', (_entity, entityId) => {
			const view = this.axes.get(entityId);
			if (view) {
				view.removed = true;
				view.root.dispose();
			}
			this.axes.delete(entityId);
		});
	}

	dispose(): void {
		this.scene.onBeforeRenderObservable.remove(this.observer);
		this.axes.forEach((view) => view.root.dispose());
		this.axes.clear();
	}

	private async add(entity: CombatEntity, entityId: string): Promise<void> {
		const placeholder = new BABYLON.TransformNode(
			`axe:${entityId}`,
			this.scene,
		);
		const view: AxeView = { root: placeholder, entity, removed: false };
		this.axes.set(entityId, view);
		const result = await BABYLON.ImportMeshAsync(models.axe, this.scene);
		if (view.removed || this.axes.get(entityId) !== view) {
			result.meshes.forEach((mesh) => mesh.dispose());
			return;
		}
		for (const mesh of result.meshes) {
			if (!mesh.parent) mesh.parent = placeholder;
			this.map.prepareRenderable(mesh);
			mesh.isPickable = false;
		}
		placeholder.scaling.setAll(0.65);
		this.updatePosition(view);
	}

	private animate(): void {
		const speed = (720 * Math.PI) / 180;
		for (const view of this.axes.values()) {
			this.updatePosition(view);
			if (view.entity.phase !== 'active') continue;
			const age = Math.max(
				0,
				this.room.state.combatTimeS - view.entity.phaseStartedAtS,
			);
			view.root.rotation.y = view.entity.rotationY;
			view.root.rotation.z = age * speed;
		}
	}

	private updatePosition(view: AxeView): void {
		view.root.position.set(view.entity.x, view.entity.y, view.entity.z);
		if (view.entity.phase === 'flying') {
			view.root.rotation.y = view.entity.rotationY;
			view.root.rotation.x +=
				this.scene.getEngine().getDeltaTime() * 0.012;
		}
	}
}
