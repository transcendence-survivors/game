import * as BABYLON from '@babylonjs/core';
import type { WeaponKind } from '../../../shared-package';
import { weaponModels } from '../assets/models/weapons/weaponModels';
import { CombatAssetLibrary } from './CombatAssetLibrary';

type VisibleWeapon = Exclude<WeaponKind, 'aura' | 'axe'>;

export class WeaponAttachmentRenderer {
	private readonly roots = new Map<string, BABYLON.TransformNode[]>();
	private readonly generations = new Map<string, number>();
	private readonly assets: CombatAssetLibrary;
	private disposed = false;

	constructor(assets: CombatAssetLibrary) {
		this.assets = assets;
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
	}

	private async attach(
		weapon: VisibleWeapon,
		playerId: string,
		player: BABYLON.AbstractMesh,
		generation: number,
	): Promise<void> {
		const root = await this.assets.instantiate(weapon, `${weapon}:${playerId}`);
		if (
			this.disposed ||
			player.isDisposed() ||
			this.generations.get(playerId) !== generation
		) {
			root.dispose();
			return;
		}
		const transform = weaponModels[weapon].attachment;
		if (!transform) {
			root.dispose();
			return;
		}
		root.parent = player;
		root.position.set(...transform.position);
		root.rotation.set(...transform.rotation);
		root.scaling.setAll(transform.scale);
		const roots = this.roots.get(playerId) ?? [];
		roots.push(root);
		this.roots.set(playerId, roots);
	}

	private disposeRoots(playerId: string): void {
		this.roots.get(playerId)?.forEach((root) => root.dispose());
		this.roots.delete(playerId);
	}
}
