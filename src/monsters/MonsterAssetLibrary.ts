import * as BABYLON from '@babylonjs/core';
import { models, type MonsterModel } from '../assets/models';

export interface MonsterModel {
	root: BABYLON.TransformNode;
	animationGroups: BABYLON.AnimationGroup[];
}

export class MonsterAssetLibrary {
	private scene!: BABYLON.Scene;
	private containers = new Map<string, Promise<BABYLON.AssetContainer>>();

	constructor(scene: BABYLON.Scene) {
		this.scene = scene;
	}

	private modelUrl(monster: MonsterModel): string {
		return models.monster[monster];
	}

	private loadContainer(
		monster: MonsterModel,
	): Promise<BABYLON.AssetContainer> {
		const url = this.modelUrl(monster);
		let container = this.containers.get(url);
		if (!container) {
			container = BABYLON.LoadAssetContainerAsync(url, this.scene);
			this.containers.set(url, container);
		}
		return container;
	}

	async instantiate(monster: MonsterModel): Promise<MonsterModel> {
		const container = await this.loadContainer(monster);
		const instance = container.instantiateModelsToScene(
			(name) => `${monster}_${name}`,
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
