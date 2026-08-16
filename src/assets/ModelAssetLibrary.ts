import type {
	AbstractMesh,
	AnimationGroup,
	Scene,
} from '@babylonjs/core';
import { AssetContainerCache } from './AssetContainerCache';

export interface ModelInstance {
	root: AbstractMesh;
	animationGroups: AnimationGroup[];
}

export class ModelAssetLibrary {
	private readonly assets: AssetContainerCache;

	constructor(scene: Scene) {
		this.assets = new AssetContainerCache(scene);
	}

	async instantiate(url: string, name: string): Promise<ModelInstance> {
		const container = await this.assets.load(url);
		const instance = container.instantiateModelsToScene(
			(nodeName) => `${name}:${nodeName}`,
		);
		return {
			root: instance.rootNodes[0] as AbstractMesh,
			animationGroups: instance.animationGroups,
		};
	}

	dispose(): void {
		this.assets.dispose();
	}
}
