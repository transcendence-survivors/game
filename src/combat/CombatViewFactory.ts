import * as BABYLON from '@babylonjs/core';
import { type CombatEntity, weaponConfigRegistry } from '../../../shared-package';
import {
	weaponModels,
	type WeaponModelTransform,
} from '../assets/models/weapons/weaponModels';
import { CombatAssetLibrary } from './CombatAssetLibrary';
import { CombatEntityView, ProjectileView } from './CombatEntityView';

class AxeView extends ProjectileView {
	protected animate(deltaTimeS: number, combatTimeS: number): void {
		super.animate(deltaTimeS, combatTimeS);
		if (this.entity.phase === 'flying') this.root.rotation.x += deltaTimeS * 12;
		else this.root.rotation.z = Math.max(0, combatTimeS - this.entity.phaseStartedAtS) * Math.PI * 4;
	}
}

class FireballView extends ProjectileView {
	private readonly seed: number;

	constructor(entity: CombatEntity, root: BABYLON.TransformNode, seed: number) {
		super(entity, root);
		this.seed = seed;
	}

	protected animate(deltaTimeS: number, combatTimeS: number): void {
		super.animate(deltaTimeS, combatTimeS);
		const pulse = 1 + Math.sin(combatTimeS * 8 + this.seed * Math.PI * 2) * 0.08;
		this.root.scaling.setAll(pulse);
	}
}

export class CombatViewFactory {
	private readonly slashSource: BABYLON.Mesh;
	private readonly slashMaterial: BABYLON.StandardMaterial;
	private readonly fireballSource: BABYLON.Mesh;
	private readonly fireballMaterial: BABYLON.StandardMaterial;
	private readonly scene: BABYLON.Scene;
	private readonly assets: CombatAssetLibrary;

	constructor(scene: BABYLON.Scene, assets: CombatAssetLibrary) {
		this.scene = scene;
		this.assets = assets;
		const slash = this.createSlashSource();
		this.slashSource = slash.mesh;
		this.slashMaterial = slash.material;
		this.fireballMaterial = new BABYLON.StandardMaterial('fireballMaterial', scene);
		this.fireballMaterial.disableLighting = true;
		this.fireballMaterial.emissiveColor.set(1, 0.35, 0.03);
		this.fireballMaterial.alpha = 0.95;
		this.fireballSource = BABYLON.MeshBuilder.CreateIcoSphere(
			'fireballSource',
			{ radius: 0.65, subdivisions: 2 },
			scene,
		);
		this.fireballSource.material = this.fireballMaterial;
		this.fireballSource.isVisible = false;
		this.fireballSource.isPickable = false;
	}

	async create(entity: CombatEntity, id: string): Promise<CombatEntityView> {
		switch (entity.kind) {
			case 'sword-slash': {
				const root = this.slashSource.createInstance(`swordSlash:${id}`);
				root.scaling.setAll(entity.scale);
				return new CombatEntityView(entity, root);
			}
			case 'axe': {
				const root = await this.assets.instantiate('axe', `axe:${id}`);
				this.applyTransform(root, weaponModels.axe.combat!);
				return new AxeView(entity, root);
			}
			case 'fireball': {
				const root = this.fireballSource.createInstance(`fireball:${id}`);
				return new FireballView(entity, root, this.hash(id));
			}
			case 'arrow': {
				const root = await this.assets.instantiate('arrow', `arrow:${id}`);
				this.applyTransform(root, weaponModels.arrow.combat!);
				return new ProjectileView(entity, root);
			}
		}
	}

	private applyTransform(
		root: BABYLON.TransformNode,
		transform: WeaponModelTransform,
	): void {
		root.position.set(...transform.position);
		root.rotation.set(...transform.rotation);
		root.scaling.setAll(transform.scale);
	}

	dispose(): void {
		this.slashSource.dispose();
		this.slashMaterial.dispose();
		this.fireballSource.dispose();
		this.fireballMaterial.dispose();
	}

	private createSlashSource(): {
		mesh: BABYLON.Mesh;
		material: BABYLON.StandardMaterial;
	} {
		const config = weaponConfigRegistry.get('sword');
		const halfAngle = (config.totalAngleDegrees * Math.PI) / 360;
		const segments = 20;
		const positions: number[] = [0, 0, 0];
		const indices: number[] = [];
		for (let index = 0; index <= segments; index++) {
			const angle = -halfAngle + (index / segments) * halfAngle * 2;
			positions.push(Math.sin(angle), 0, Math.cos(angle));
			if (index > 0) indices.push(0, index, index + 1);
		}
		const mesh = new BABYLON.Mesh('swordSlashSource', this.scene);
		const data = new BABYLON.VertexData();
		data.positions = positions;
		data.indices = indices;
		data.normals = [];
		BABYLON.VertexData.ComputeNormals(positions, indices, data.normals);
		data.applyToMesh(mesh);
		const material = new BABYLON.StandardMaterial('swordSlashMaterial', this.scene);
		material.disableLighting = true;
		material.emissiveColor.set(1, 0.62, 0.2);
		material.alpha = 0.85;
		material.backFaceCulling = false;
		mesh.material = material;
		mesh.isVisible = false;
		mesh.isPickable = false;
		return { mesh, material };
	}

	private hash(value: string): number {
		let hash = 2166136261;
		for (let index = 0; index < value.length; index++) {
			hash ^= value.charCodeAt(index);
			hash = Math.imul(hash, 16777619);
		}
		return (hash >>> 0) / 4294967295;
	}
}
