import * as BABYLON from '@babylonjs/core';
import { TAU, type CombatEntity } from '@transcendence/game-shared';
import {
	weaponModels,
	type WeaponModelTransform,
} from '../assets/models/weapons/weaponModels';
import { CombatAssetLibrary } from './CombatAssetLibrary';
import { CombatEntityView, ProjectileView } from './CombatEntityView';

class AxeView extends ProjectileView {
	private readonly spinner: BABYLON.TransformNode;

	constructor(
		entity: CombatEntity,
		root: BABYLON.TransformNode,
		spinner: BABYLON.TransformNode,
	) {
		super(entity, root);
		this.spinner = spinner;
	}

	protected animate(deltaTimeS: number, combatTimeS: number): void {
		super.animate(deltaTimeS, combatTimeS);
		this.spinner.rotation.y += deltaTimeS * 12;
	}
}

class FireballView extends ProjectileView {
	private readonly seed: number;

	constructor(
		entity: CombatEntity,
		root: BABYLON.TransformNode,
		seed: number,
	) {
		super(entity, root);
		this.seed = seed;
	}

	protected animate(deltaTimeS: number, combatTimeS: number): void {
		super.animate(deltaTimeS, combatTimeS);
		const pulse = 1 + Math.sin(combatTimeS * 8 + this.seed * TAU) * 0.08;
		this.root.scaling.setAll(pulse);
	}
}

export class CombatViewFactory {
	private readonly fireballSource: BABYLON.Mesh;
	private readonly fireballMaterial: BABYLON.StandardMaterial;
	private readonly fireballGlowSource: BABYLON.Mesh;
	private readonly fireballGlowMaterial: BABYLON.StandardMaterial;
	private readonly scene: BABYLON.Scene;
	private readonly assets: CombatAssetLibrary;

	constructor(scene: BABYLON.Scene, assets: CombatAssetLibrary) {
		this.scene = scene;
		this.assets = assets;
		[this.fireballSource, this.fireballMaterial] = this.createFireballLayer(
			'fireball',
			0.52,
			[1, 0.2, 0.01],
			[1, 0.3, 0.015],
		);
		[this.fireballGlowSource, this.fireballGlowMaterial] =
			this.createFireballLayer(
				'fireballGlow',
				0.76,
				[0.9, 0.08, 0],
				[1, 0.12, 0.005],
			);
		Object.assign(this.fireballGlowMaterial, {
			alpha: 0.28,
			alphaMode: BABYLON.Constants.ALPHA_ADD,
			backFaceCulling: false,
		});
	}

	private createFireballLayer(
		name: string,
		radius: number,
		diffuse: readonly [number, number, number],
		emissive: readonly [number, number, number],
	): readonly [BABYLON.Mesh, BABYLON.StandardMaterial] {
		const material = new BABYLON.StandardMaterial(
			`${name}Material`,
			this.scene,
		);
		material.disableLighting = true;
		material.diffuseColor.set(...diffuse);
		material.emissiveColor.set(...emissive);
		const source = BABYLON.MeshBuilder.CreateIcoSphere(
			`${name}Source`,
			{ radius, subdivisions: 2 },
			this.scene,
		);
		source.material = material;
		source.isVisible = false;
		source.isPickable = false;
		return [source, material];
	}

	async create(entity: CombatEntity, id: string): Promise<CombatEntityView> {
		switch (entity.kind) {
			case 'sword-slash': {
				const root = new BABYLON.TransformNode(
					`swordSlash:${id}`,
					this.scene,
				);
				return new CombatEntityView(entity, root);
			}
			case 'axe':
			case 'arrow':
				return this.createModelProjectile(entity, id, entity.kind);
			case 'fireball': {
				const root = new BABYLON.TransformNode(
					`fireball:${id}`,
					this.scene,
				);
				const core = this.fireballSource.createInstance(
					`fireballCore:${id}`,
				);
				const glow = this.fireballGlowSource.createInstance(
					`fireballGlow:${id}`,
				);
				core.parent = root;
				glow.parent = root;
				core.isVisible = true;
				glow.isVisible = true;
				return new FireballView(entity, root, this.hash(id));
			}
		}
	}

	private async createModelProjectile(
		entity: CombatEntity,
		id: string,
		kind: 'arrow' | 'axe',
	): Promise<ProjectileView> {
		const root = new BABYLON.TransformNode(`${kind}:${id}`, this.scene);
		const model = await this.assets.instantiate(kind, `${kind}Model:${id}`);
		let parent = root;
		if (kind === 'axe') {
			parent = new BABYLON.TransformNode(`axeSpinner:${id}`, this.scene);
			parent.parent = root;
		}
		model.parent = parent;
		this.applyTransform(model, weaponModels[kind].combat);
		if (kind === 'axe') {
			model.scaling.scaleInPlace(entity.scale);
			return new AxeView(entity, root, parent);
		}
		return new ProjectileView(entity, root);
	}

	private applyTransform(
		root: BABYLON.TransformNode,
		transform: WeaponModelTransform,
	): void {
		root.rotationQuaternion = null;
		root.position.set(...transform.position);
		root.rotation.set(...transform.rotation);
		root.scaling.setAll(transform.scale);
	}

	dispose(): void {
		this.fireballSource.dispose();
		this.fireballMaterial.dispose();
		this.fireballGlowSource.dispose();
		this.fireballGlowMaterial.dispose();
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
