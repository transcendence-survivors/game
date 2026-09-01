import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import {
	weaponModels,
	type WeaponModel,
} from '../assets/models/weapons/weaponModels';
import type { MapGenerator } from '../map/MapGenerator';
import { ModelAssetLibrary } from '../assets/ModelAssetLibrary';

export class CombatAssetLibrary {
	private readonly assets: ModelAssetLibrary;
	private readonly scene: BABYLON.Scene;
	private readonly map: MapGenerator;
	private disposed = false;

	constructor(
		scene: BABYLON.Scene,
		map: MapGenerator,
	) {
		this.scene = scene;
		this.map = map;
		this.assets = new ModelAssetLibrary(scene);
	}

	async instantiate(model: WeaponModel, name: string): Promise<BABYLON.TransformNode> {
		if (this.disposed) throw new Error('weapon asset library is disposed');
		let root: BABYLON.TransformNode;
		try {
			root = (
				await this.assets.instantiate(weaponModels[model].url, name)
			).root;
		} catch (error) {
			console.error(`failed to load weapon model '${model}'`, error);
			root = this.createFallback(model, name);
		}
		this.map.prepareRenderable(root, false);
		root.getChildMeshes().forEach((mesh) => (mesh.isPickable = false));
		return root;
	}

	dispose(): void {
		this.disposed = true;
		this.assets.dispose();
	}

	private createFallback(model: WeaponModel, name: string): BABYLON.TransformNode {
		const root = new BABYLON.TransformNode(`${name}:fallback`, this.scene);
		const dimensions = weaponModels[model].dimensions;
		const mesh = BABYLON.MeshBuilder.CreateBox(
			`${name}:fallbackMesh`,
			{
				width: Math.max(dimensions[0], 0.12),
				height: Math.max(dimensions[1], 0.12),
				depth: Math.max(dimensions[2], 0.12),
			},
			this.scene,
		);
		const material = new BABYLON.StandardMaterial(`${name}:fallbackMaterial`, this.scene);
		material.disableLighting = true;
		material.emissiveColor.set(0.8, 0.2, 0.8);
		mesh.material = material;
		mesh.parent = root;
		root.onDisposeObservable.addOnce(() => material.dispose());
		return root;
	}
}
