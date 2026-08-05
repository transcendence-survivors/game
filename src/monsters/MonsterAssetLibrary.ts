import * as BABYLON from '@babylonjs/core';
import { models, type MonsterGLB } from '../assets/models';

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

	private modelUrl(monster: MonsterGLB): string {
		return models.monster[monster];
	}

	private loadContainer(
		monster: MonsterGLB,
	): Promise<BABYLON.AssetContainer> {
		const url = this.modelUrl(monster);
		let container = this.containers.get(url);
		if (!container) {
			container = BABYLON.LoadAssetContainerAsync(url, this.scene);
			this.containers.set(url, container);
		}
		return container;
	}

	async instantiate(monster: string): Promise<MonsterModel> {
		const container = await this.loadContainer(monster as MonsterGLB);
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
