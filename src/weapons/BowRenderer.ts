import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import * as COLYSEUS from '@colyseus/sdk';
import type { CombatEntity, GameState } from '../../../shared-package';
import { models } from '../assets/models';
import type { MapGenerator } from '../map/MapGenerator';

interface ArrowView {
	instance: BABYLON.InstancedMesh;
	entity: CombatEntity;
	target: BABYLON.Vector3;
}

export class BowRenderer {
	private readonly arrows = new Map<string, ArrowView>();
	private readonly pending = new Map<string, CombatEntity>();
	private readonly pool: BABYLON.InstancedMesh[] = [];
	private readonly bowRoots = new Map<string, BABYLON.TransformNode>();
	private readonly removedPlayers = new Set<string>();
	private readonly observer: BABYLON.Observer<BABYLON.Scene>;
	private readonly scene: BABYLON.Scene;
	private readonly room: COLYSEUS.Room<GameState>;
	private readonly map: MapGenerator;
	private source?: BABYLON.Mesh;
	private disposed = false;

	constructor(
		scene: BABYLON.Scene,
		room: COLYSEUS.Room<GameState>,
		map: MapGenerator,
	) {
		this.scene = scene;
		this.room = room;
		this.map = map;
		this.observer = scene.onBeforeRenderObservable.add(() => this.animate());
		void this.loadArrow();
	}

	listen(): void {
		const callbacks = COLYSEUS.Callbacks.get(this.room);
		callbacks.onAdd('combatEntities', (entity, id) => {
			if (entity.kind !== 'arrow') return;
			if (!this.source) {
				this.pending.set(id, entity);
				return;
			}
			this.addArrow(entity, id);
		});
		callbacks.onRemove('combatEntities', (_entity, id) => {
			this.pending.delete(id);
			const view = this.arrows.get(id);
			if (!view) return;
			view.instance.isVisible = false;
			this.pool.push(view.instance);
			this.arrows.delete(id);
		});
	}

	async attachToPlayer(playerId: string, player: BABYLON.AbstractMesh): Promise<void> {
		this.removedPlayers.delete(playerId);
		const result = await BABYLON.ImportMeshAsync(models.bow, this.scene);
		const root = new BABYLON.TransformNode(`bow:${playerId}`, this.scene);
		for (const mesh of result.meshes) {
			if (!mesh.parent) mesh.parent = root;
			this.map.prepareRenderable(mesh);
			mesh.isPickable = false;
		}
		if (this.removedPlayers.has(playerId) || player.isDisposed()) {
			root.dispose();
			return;
		}
		root.parent = player;
		root.position.set(0.55, 0.9, -0.2);
		root.rotation.set(0, Math.PI / 2, -Math.PI / 14);
		root.scaling.setAll(0.65);
		this.bowRoots.get(playerId)?.dispose();
		this.bowRoots.set(playerId, root);
	}

	removePlayer(playerId: string): void {
		this.removedPlayers.add(playerId);
		this.bowRoots.get(playerId)?.dispose();
		this.bowRoots.delete(playerId);
	}

	dispose(): void {
		this.disposed = true;
		this.scene.onBeforeRenderObservable.remove(this.observer);
		this.arrows.forEach((view) => view.instance.dispose());
		this.pool.forEach((instance) => instance.dispose());
		this.bowRoots.forEach((root) => root.dispose());
		this.source?.dispose();
		this.arrows.clear();
		this.pending.clear();
		this.pool.length = 0;
		this.bowRoots.clear();
	}

	private async loadArrow(): Promise<void> {
		const result = await BABYLON.ImportMeshAsync(models.arrow, this.scene);
		if (this.disposed) {
			result.meshes.forEach((mesh) => mesh.dispose());
			return;
		}
		const source = result.meshes.find(
			(mesh): mesh is BABYLON.Mesh =>
				mesh instanceof BABYLON.Mesh && mesh.getTotalVertices() > 0,
		);
		if (!source) {
			result.meshes.forEach((mesh) => mesh.dispose());
			return;
		}
		source.parent = null;
		source.setEnabled(true);
		source.isVisible = false;
		source.isPickable = false;
		this.map.prepareRenderable(source);
		this.source = source;
		for (const [id, entity] of this.pending) this.addArrow(entity, id);
		this.pending.clear();
		for (const mesh of result.meshes) {
			if (mesh !== source && !mesh.isDescendantOf(source)) mesh.dispose();
		}
	}

	private addArrow(entity: CombatEntity, id: string): void {
		if (!this.source) return;
		const instance = this.pool.pop() ?? this.source.createInstance(`arrow:${id}`);
		instance.rotationQuaternion = null;
		instance.position.set(entity.x, entity.y, entity.z);
		instance.rotation.set(0, entity.rotationY, Math.PI / 2);
		instance.scaling.setAll(0.65);
		instance.isPickable = false;
		instance.isVisible = true;
		this.arrows.set(id, {
			instance,
			entity,
			target: new BABYLON.Vector3(entity.x, entity.y, entity.z),
		});
	}

	private animate(): void {
		const factor = Math.min(1, this.scene.getEngine().getDeltaTime() / 50);
		for (const view of this.arrows.values()) {
			view.target.set(view.entity.x, view.entity.y, view.entity.z);
			BABYLON.Vector3.LerpToRef(
				view.instance.position,
				view.target,
				factor,
				view.instance.position,
			);
			view.instance.rotation.y = view.entity.rotationY;
		}
	}
}
