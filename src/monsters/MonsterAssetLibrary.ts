import * as BABYLON from '@babylonjs/core';

export interface MonsterModel {
	root: BABYLON.TransformNode;
	animationGroups: BABYLON.AnimationGroup[];
}

/**
 * Loads monster/boss glb files (mesh + materials + animations) once per
 * kind and hands out independent instances, so ten skitters share one
 * download and one set of materials.
 */
export class MonsterAssetLibrary {
	private scene!: BABYLON.Scene;
	private containers = new Map<string, Promise<BABYLON.AssetContainer>>();

	constructor(scene: BABYLON.Scene) {
		this.scene = scene;
	}

	private modelUrl(kind: string, isBoss: boolean): string {
		const folder = isBoss ? 'boss' : 'monster';
		return `/models/${folder}/${kind}/${kind}.glb`;
	}

	private loadContainer(
		kind: string,
		isBoss: boolean,
	): Promise<BABYLON.AssetContainer> {
		const url = this.modelUrl(kind, isBoss);
		let container = this.containers.get(url);
		if (!container) {
			container = BABYLON.LoadAssetContainerAsync(url, this.scene);
			this.containers.set(url, container);
		}
		return container;
	}

	async instantiate(kind: string, isBoss: boolean): Promise<MonsterModel> {
		const container = await this.loadContainer(kind, isBoss);
		const instance = container.instantiateModelsToScene(
			(name) => `${kind}_${name}`,
		);
		instance.animationGroups.forEach((group) => group.stop());
		return {
			root: instance.rootNodes[0] as BABYLON.TransformNode,
			animationGroups: instance.animationGroups,
		};
	}

	dispose() {
		this.containers.forEach((pending) => {
			pending.then((container) => container.dispose()).catch(() => {});
		});
		this.containers.clear();
	}
}
