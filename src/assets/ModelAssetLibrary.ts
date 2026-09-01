import type {
	AbstractMesh,
	AnimationGroup,
	AssetContainer,
	Scene,
} from '@babylonjs/core';
import { AssetContainerCache } from './AssetContainerCache';
import { getCachedPromise } from './PromiseCache';

export interface ModelInstance {
	root: AbstractMesh;
	animationGroups: AnimationGroup[];
}

interface ModelInstantiationOptions {
	doNotInstantiate?: boolean;
}

export class ModelAssetLibrary {
	private readonly assets: AssetContainerCache;
	private readonly preparations = new Map<string, Promise<void>>();

	constructor(scene: Scene, assets = new AssetContainerCache(scene)) {
		this.assets = assets;
	}

	async instantiate(
		url: string,
		name: string,
		options?: ModelInstantiationOptions,
	): Promise<ModelInstance> {
		const container = await this.assets.load(url);
		const nameFunction = (nodeName: string) => `${name}:${nodeName}`;
		const instance = options
			? container.instantiateModelsToScene(nameFunction, false, options)
			: container.instantiateModelsToScene(nameFunction, false);
		return {
			root: instance.rootNodes[0] as AbstractMesh,
			animationGroups: instance.animationGroups,
		};
	}

	async prepare(
		url: string,
		prepare: (container: AssetContainer) => void,
	): Promise<void> {
		await getCachedPromise(this.preparations, url, () =>
			this.assets.load(url).then(prepare),
		);
	}

	dispose(): void {
		this.preparations.clear();
		this.assets.dispose();
	}
}
