import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import '@babylonjs/loaders/OBJ';
import type { WeaponKind } from '../../../shared-package';
import { models } from '../assets/models';
import type { MapGenerator } from '../map/MapGenerator';

type VisibleWeapon = Exclude<WeaponKind, 'aura' | 'axe'>;

const transforms: Record<VisibleWeapon, {
	position: readonly [number, number, number];
	rotation: readonly [number, number, number];
	scale: number;
}> = {
	sword: {
		position: [0.55, 1.05, 0.15],
		rotation: [0, 0, -Math.PI / 7],
		scale: 0.012,
	},
	staff: {
		position: [-0.55, 0.95, 0.15],
		rotation: [0, 0, Math.PI / 14],
		scale: 0.65,
	},
	bow: {
		position: [0.55, 0.9, -0.2],
		rotation: [0, Math.PI / 2, -Math.PI / 14],
		scale: 0.65,
	},
};

export class WeaponAttachmentRenderer {
	private readonly containers = new Map<VisibleWeapon, Promise<BABYLON.AssetContainer>>();
	private readonly roots = new Map<string, BABYLON.TransformNode[]>();
	private readonly generations = new Map<string, number>();
	private readonly scene: BABYLON.Scene;
	private readonly map: MapGenerator;
	private disposed = false;

	constructor(scene: BABYLON.Scene, map: MapGenerator) {
		this.scene = scene;
		this.map = map;
	}

	attachToPlayer(playerId: string, player: BABYLON.AbstractMesh): void {
		const generation = (this.generations.get(playerId) ?? 0) + 1;
		this.generations.set(playerId, generation);
		this.disposeRoots(playerId);
		for (const weapon of ['sword', 'staff', 'bow'] as const) {
			void this.attach(weapon, playerId, player, generation);
		}
	}

	removePlayer(playerId: string): void {
		this.generations.set(playerId, (this.generations.get(playerId) ?? 0) + 1);
		this.disposeRoots(playerId);
	}

	dispose(): void {
		this.disposed = true;
		this.generations.clear();
		this.roots.forEach((roots) => roots.forEach((root) => root.dispose()));
		this.roots.clear();
		this.containers.forEach((pending) => pending.then((container) => container.dispose()).catch(() => {}));
		this.containers.clear();
	}

	private async attach(
		weapon: VisibleWeapon,
		playerId: string,
		player: BABYLON.AbstractMesh,
		generation: number,
	): Promise<void> {
		const container = await this.load(weapon);
		const instance = container.instantiateModelsToScene((name) => `${weapon}:${playerId}:${name}`);
		const root = instance.rootNodes[0] as BABYLON.TransformNode;
		if (this.disposed || player.isDisposed() || this.generations.get(playerId) !== generation) {
			root.dispose();
			return;
		}
		root.getChildMeshes().forEach((mesh) => {
			this.map.prepareRenderable(mesh);
			mesh.isPickable = false;
		});
		const transform = transforms[weapon];
		root.parent = player;
		root.position.set(...transform.position);
		root.rotation.set(...transform.rotation);
		root.scaling.setAll(transform.scale);
		const roots = this.roots.get(playerId) ?? [];
		roots.push(root);
		this.roots.set(playerId, roots);
	}

	private load(weapon: VisibleWeapon): Promise<BABYLON.AssetContainer> {
		let pending = this.containers.get(weapon);
		if (!pending) {
			pending = BABYLON.LoadAssetContainerAsync(models[weapon], this.scene);
			this.containers.set(weapon, pending);
		}
		return pending;
	}

	private disposeRoots(playerId: string): void {
		this.roots.get(playerId)?.forEach((root) => root.dispose());
		this.roots.delete(playerId);
	}
}
