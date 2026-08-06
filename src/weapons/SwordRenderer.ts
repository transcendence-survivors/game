import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/OBJ';
import * as COLYSEUS from '@colyseus/sdk';
import {
	type CombatEntity,
	type GameState,
	weaponConfigRegistry,
} from '../../../shared-package';
import { models } from '../assets/models';
import type { MapGenerator } from '../map/MapGenerator';

export class SwordRenderer {
	private readonly scene: BABYLON.Scene;
	private readonly room: COLYSEUS.Room<GameState>;
	private readonly map: MapGenerator;
	private readonly slashes = new Map<string, BABYLON.Mesh>();
	private readonly swordRoots = new Map<string, BABYLON.TransformNode>();
	private readonly removedPlayers = new Set<string>();
	private readonly slashMaterial: BABYLON.StandardMaterial;

	constructor(
		scene: BABYLON.Scene,
		room: COLYSEUS.Room<GameState>,
		map: MapGenerator,
	) {
		this.scene = scene;
		this.room = room;
		this.map = map;
		this.slashMaterial = new BABYLON.StandardMaterial(
			'swordSlashMaterial',
			scene,
		);
		this.slashMaterial.disableLighting = true;
		this.slashMaterial.diffuseColor = BABYLON.Color3.Black();
		this.slashMaterial.emissiveColor = new BABYLON.Color3(1, 0.62, 0.2);
		this.slashMaterial.alpha = 0.85;
		this.slashMaterial.alphaMode = BABYLON.Constants.ALPHA_ADD;
		this.slashMaterial.backFaceCulling = false;
	}

	listen(): void {
		const callbacks = COLYSEUS.Callbacks.get(this.room);
		callbacks.onAdd('combatEntities', (entity, entityId) => {
			if (entity.kind === 'sword-slash') this.addSlash(entity, entityId);
		});
		callbacks.onRemove('combatEntities', (_entity, entityId) => {
			this.slashes.get(entityId)?.dispose();
			this.slashes.delete(entityId);
		});
	}

	async attachToPlayer(
		playerId: string,
		player: BABYLON.AbstractMesh,
	): Promise<void> {
		this.removedPlayers.delete(playerId);
		const result = await BABYLON.ImportMeshAsync(models.sword, this.scene);
		const root = new BABYLON.TransformNode(`sword:${playerId}`, this.scene);
		for (const mesh of result.meshes) {
			if (!mesh.parent) mesh.parent = root;
			this.map.prepareRenderable(mesh);
		}
		if (this.removedPlayers.has(playerId) || player.isDisposed()) {
			root.dispose();
			return;
		}
		root.parent = player;
		root.position.set(0.55, 1.05, 0.15);
		root.rotation.set(0, 0, -Math.PI / 7);
		root.scaling.setAll(0.012);
		this.swordRoots.get(playerId)?.dispose();
		this.swordRoots.set(playerId, root);
	}

	removePlayer(playerId: string): void {
		this.removedPlayers.add(playerId);
		this.swordRoots.get(playerId)?.dispose();
		this.swordRoots.delete(playerId);
	}

	dispose(): void {
		this.slashes.forEach((mesh) => mesh.dispose());
		this.swordRoots.forEach((root) => root.dispose());
		this.slashes.clear();
		this.swordRoots.clear();
		this.removedPlayers.clear();
		this.slashMaterial.dispose();
	}

	private addSlash(entity: CombatEntity, entityId: string): void {
		this.animateSword(entity.ownerSessionId);
		const config = weaponConfigRegistry.get('sword');
		const halfAngle = (config.totalAngleDegrees * Math.PI) / 360;
		const segments = 20;
		const positions: number[] = [0, 0, 0];
		const indices: number[] = [];
		for (let index = 0; index <= segments; index++) {
			const angle = -halfAngle + (index / segments) * halfAngle * 2;
			positions.push(
				Math.sin(angle) * entity.scale,
				0,
				Math.cos(angle) * entity.scale,
			);
			if (index > 0) indices.push(0, index, index + 1);
		}
		const mesh = new BABYLON.Mesh(`swordSlash:${entityId}`, this.scene);
		const data = new BABYLON.VertexData();
		data.positions = positions;
		data.indices = indices;
		data.normals = [];
		BABYLON.VertexData.ComputeNormals(positions, indices, data.normals);
		data.applyToMesh(mesh);
		mesh.material = this.slashMaterial;
		mesh.position.set(entity.x, entity.y + 0.18, entity.z);
		mesh.rotation.y = entity.rotationY;
		mesh.isPickable = false;
		this.slashes.set(entityId, mesh);
	}

	private animateSword(playerId: string): void {
		const sword = this.swordRoots.get(playerId);
		if (!sword) return;
		BABYLON.Animation.CreateAndStartAnimation(
			`swordSwing:${playerId}`,
			sword,
			'rotation.z',
			60,
			15,
			-Math.PI / 7,
			Math.PI / 2,
			BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
			undefined,
			() => {
				if (!sword.isDisposed()) sword.rotation.z = -Math.PI / 7;
			},
		);
	}
}
