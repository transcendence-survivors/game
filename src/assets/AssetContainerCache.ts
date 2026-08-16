import {
	LoadAssetContainerAsync,
	type AssetContainer,
	type Scene,
} from '@babylonjs/core';

export class AssetContainerCache {
	private readonly containers = new Map<string, Promise<AssetContainer>>();
	private readonly scene: Scene;

	constructor(scene: Scene) {
		this.scene = scene;
	}

	load(url: string): Promise<AssetContainer> {
		let pending = this.containers.get(url);
		if (!pending) {
			pending = LoadAssetContainerAsync(url, this.scene);
			this.containers.set(url, pending);
		}
		return pending;
	}

	dispose(): void {
		this.containers.forEach((pending) =>
			pending.then((container) => container.dispose()).catch(() => {}),
		);
		this.containers.clear();
	}
}
