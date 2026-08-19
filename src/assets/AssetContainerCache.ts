import {
	LoadAssetContainerAsync,
	type AssetContainer,
	type Scene,
} from '@babylonjs/core';
import { getCachedPromise } from './PromiseCache';

type AssetLoader = (url: string, scene: Scene) => Promise<AssetContainer>;

export class AssetContainerCache {
	private readonly containers = new Map<string, Promise<AssetContainer>>();
	private readonly scene: Scene;
	private readonly loadAsset: AssetLoader;

	constructor(
		scene: Scene,
		loadAsset: AssetLoader = LoadAssetContainerAsync,
	) {
		this.scene = scene;
		this.loadAsset = loadAsset;
	}

	load(url: string): Promise<AssetContainer> {
		return getCachedPromise(this.containers, url, () =>
			this.loadAsset(url, this.scene),
		);
	}

	dispose(): void {
		this.containers.forEach((pending) =>
			pending.then((container) => container.dispose()).catch(() => {}),
		);
		this.containers.clear();
	}
}
