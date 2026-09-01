import * as BABYLON from '@babylonjs/core';
import type { CombatEntity, GameState } from '@transcendence/game-shared';
import {
	COMBAT_HITBOX_RENDERING_GROUP,
	preserveWorldDepthForDebug,
} from './DebugRenderingGroups';
import { configureDebugMesh, createDebugMaterial } from './DebugMaterial';

export class CombatHitboxDebugRenderer {
	private readonly scene: BABYLON.Scene;
	private readonly state: GameState;
	private readonly meshes = new Map<string, BABYLON.Mesh>();
	private readonly auraMeshes = new Map<string, BABYLON.Mesh>();
	private readonly weaponMaterial: BABYLON.StandardMaterial;
	private readonly auraMaterial: BABYLON.StandardMaterial;
	private visible = false;

	constructor(scene: BABYLON.Scene, state: GameState) {
		this.scene = scene;
		this.state = state;
		preserveWorldDepthForDebug(scene);
		this.weaponMaterial = createDebugMaterial(
			scene,
			'weaponHitbox3d',
			new BABYLON.Color3(1, 0.75, 0.05),
		);
		this.auraMaterial = createDebugMaterial(
			scene,
			'auraHitbox3d',
			new BABYLON.Color3(0.05, 0.9, 1),
		);
	}

	setVisible(visible: boolean) {
		this.visible = visible;
		if (!visible) {
			this.meshes.forEach((mesh) => mesh.dispose());
			this.auraMeshes.forEach((mesh) => mesh.dispose());
			this.meshes.clear();
			this.auraMeshes.clear();
		}
	}

	update() {
		if (!this.visible) return;
		this.state.combatEntities.forEach((entity, id) => {
			let mesh = this.meshes.get(id);
			if (!mesh) {
				mesh = this.createEntityMesh(entity, id);
				this.meshes.set(id, mesh);
			}
			mesh.position.set(entity.x, entity.y, entity.z);
			mesh.rotation.y = entity.rotationY;
		});
		for (const [id, mesh] of this.meshes)
			if (!this.state.combatEntities.has(id)) {
				mesh.dispose();
				this.meshes.delete(id);
			}

		this.state.players.forEach((player, id) => {
			if (player.aura.radius <= 0 || player.aura.height <= 0) return;
			let mesh = this.auraMeshes.get(id);
			if (!mesh) {
				mesh = BABYLON.MeshBuilder.CreateCylinder(
					`aura_hitbox_${id}`,
					{
						diameter: 2,
						height: 1,
						tessellation: 48,
					},
					this.scene,
				);
				this.configure(mesh, this.auraMaterial);
				this.auraMeshes.set(id, mesh);
			}
			mesh.position.set(
				player.x,
				player.y + player.aura.height / 2,
				player.z,
			);
			mesh.scaling.set(
				player.aura.radius,
				player.aura.height,
				player.aura.radius,
			);
		});
		for (const [id, mesh] of this.auraMeshes) {
			const aura = this.state.players.get(id)?.aura;
			if (!aura || aura.radius <= 0 || aura.height <= 0) {
				mesh.dispose();
				this.auraMeshes.delete(id);
			}
		}
	}

	dispose() {
		this.meshes.forEach((mesh) => mesh.dispose());
		this.auraMeshes.forEach((mesh) => mesh.dispose());
		this.weaponMaterial.dispose();
		this.auraMaterial.dispose();
	}

	private createEntityMesh(entity: CombatEntity, id: string): BABYLON.Mesh {
		let mesh: BABYLON.Mesh;
		switch (entity.hitboxShape) {
			case 'box':
				mesh = BABYLON.MeshBuilder.CreateBox(
					`combat_hitbox_${id}`,
					{
						width: entity.hitboxWidth,
						height: entity.hitboxHeight,
						depth: entity.hitboxDepth,
					},
					this.scene,
				);
				break;
			case 'cylinder':
				mesh = BABYLON.MeshBuilder.CreateCylinder(
					`combat_hitbox_${id}`,
					{
						diameter: entity.hitboxRadius * 2,
						height: entity.hitboxHeight,
						tessellation: 32,
					},
					this.scene,
				);
				break;
			case 'half-cylinder':
				mesh = this.createSector(
					`combat_hitbox_${id}`,
					entity.hitboxRadius,
					entity.hitboxHeight,
					entity.hitboxHalfAngle,
				);
				break;
			case 'sphere':
			default:
				mesh = BABYLON.MeshBuilder.CreateSphere(
					`combat_hitbox_${id}`,
					{
						diameter: entity.hitboxRadius * 2,
						segments: 16,
					},
					this.scene,
				);
		}
		this.configure(mesh, this.weaponMaterial);
		return mesh;
	}

	private createSector(
		name: string,
		radius: number,
		height: number,
		halfAngle: number,
	) {
		const segments = 24;
		const positions: number[] = [];
		const indices: number[] = [];
		for (const y of [-height / 2, height / 2]) {
			positions.push(0, y, 0);
			for (let i = 0; i <= segments; i++) {
				const angle = -halfAngle + (2 * halfAngle * i) / segments;
				positions.push(
					Math.sin(angle) * radius,
					y,
					Math.cos(angle) * radius,
				);
			}
		}
		const stride = segments + 2;
		for (let i = 0; i < segments; i++) {
			indices.push(0, i + 1, i + 2);
			indices.push(stride, stride + i + 2, stride + i + 1);
			indices.push(
				i + 1,
				stride + i + 1,
				i + 2,
				i + 2,
				stride + i + 1,
				stride + i + 2,
			);
		}
		indices.push(0, stride, 1, 1, stride, stride + 1);
		indices.push(
			0,
			segments + 1,
			stride,
			segments + 1,
			stride + segments + 1,
			stride,
		);
		const mesh = new BABYLON.Mesh(name, this.scene);
		const data = new BABYLON.VertexData();
		data.positions = positions;
		data.indices = indices;
		data.applyToMesh(mesh);
		return mesh;
	}

	private configure(mesh: BABYLON.Mesh, material: BABYLON.Material) {
		configureDebugMesh(mesh, material, COMBAT_HITBOX_RENDERING_GROUP);
	}
}
