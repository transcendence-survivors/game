import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import '@babylonjs/loaders/OBJ';
import { models } from '../assets/models';
import type { MapGenerator } from '../map/MapGenerator';

export type CombatModel = 'arrow' | 'axe';

export class CombatAssetLibrary {
	private readonly containers = new Map<string, Promise<BABYLON.AssetContainer>>();
	private readonly scene: BABYLON.Scene;
	private readonly map: MapGenerator;

	constructor(scene: BABYLON.Scene, map: MapGenerator) {
		this.scene = scene;
		this.map = map;
	}

	async instantiate(model: CombatModel, name: string): Promise<BABYLON.TransformNode> {
		const container = await this.load(models[model]);
		const instance = container.instantiateModelsToScene((nodeName) => `${name}:${nodeName}`);
		const root = instance.rootNodes[0] as BABYLON.TransformNode;
		root.getChildMeshes().forEach((mesh) => {
			this.map.prepareRenderable(mesh);
			mesh.isPickable = false;
		});
		return root;
	}

	dispose(): void {
		this.containers.forEach((pending) => pending.then((container) => container.dispose()).catch(() => {}));
		this.containers.clear();
	}

	private load(url: string): Promise<BABYLON.AssetContainer> {
		let pending = this.containers.get(url);
		if (!pending) {
			pending = BABYLON.LoadAssetContainerAsync(url, this.scene);
			this.containers.set(url, pending);
		}
		return pending;
	}
}
