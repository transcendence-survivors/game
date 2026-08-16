import * as BABYLON from '@babylonjs/core';
import type { WeaponKind } from '../../../shared-package';
import { weaponModels } from '../assets/models/weapons/weaponModels';
import { CombatAssetLibrary } from './CombatAssetLibrary';

type VisibleWeapon = Exclude<WeaponKind, 'aura' | 'axe'>;

const SWORD_HALF_SWEEP = Math.PI * 0.42;
const SWORD_REST_YAW = -SWORD_HALF_SWEEP;
const SWORD_POMMEL_OFFSET = 0.38;
const BOW_HORIZONTAL_PITCH = -Math.PI / 2;
const BOW_HORIZONTAL_ROLL = Math.PI / 2;
const STAFF_REST_PITCH = 0;
const STAFF_CAST_PITCH = -Math.PI / 5;
const BOW_REST_Z = 0.95;
const BOW_RECOIL_Z = 0.72;

const ATTACK_ANIMATIONS: Record<
	VisibleWeapon,
	{
		name: string;
		property: string;
		keys: ReadonlyArray<readonly [frame: number, value: number]>;
		easingMode: number;
		endFrame: number;
		reset: (root: BABYLON.TransformNode) => void;
	}
> = {
	sword: {
		name: 'swordArcYaw',
		property: 'rotation.y',
		keys: [[0, SWORD_REST_YAW], [10, 0], [20, SWORD_HALF_SWEEP]],
		easingMode: BABYLON.EasingFunction.EASINGMODE_EASEINOUT,
		endFrame: 20,
		reset: (root) => (root.rotation.y = SWORD_REST_YAW),
	},
	bow: {
		name: 'bowRecoil',
		property: 'position.z',
		keys: [[0, BOW_REST_Z], [4, BOW_RECOIL_Z], [11, BOW_REST_Z]],
		easingMode: BABYLON.EasingFunction.EASINGMODE_EASEOUT,
		endFrame: 11,
		reset: (root) => (root.position.z = BOW_REST_Z),
	},
	staff: {
		name: 'staffCastPitch',
		property: 'rotation.x',
		keys: [[0, STAFF_REST_PITCH], [7, STAFF_CAST_PITCH], [16, STAFF_REST_PITCH]],
		easingMode: BABYLON.EasingFunction.EASINGMODE_EASEINOUT,
		endFrame: 16,
		reset: (root) => (root.rotation.x = STAFF_REST_PITCH),
	},
};

function isVisibleWeapon(weapon: WeaponKind): weapon is VisibleWeapon {
	return weapon === 'sword' || weapon === 'staff' || weapon === 'bow';
}

export class WeaponAttachmentRenderer {
	private readonly roots = new Map<string, BABYLON.TransformNode[]>();
	private readonly weaponRoots = new Map<
		string,
		Map<VisibleWeapon, BABYLON.TransformNode>
	>();
	private readonly generations = new Map<string, number>();
	private readonly assets: CombatAssetLibrary;
	private disposed = false;

	constructor(assets: CombatAssetLibrary) {
		this.assets = assets;
	}

	attachToPlayer(playerId: string, _player: BABYLON.AbstractMesh): void {
		const generation = (this.generations.get(playerId) ?? 0) + 1;
		this.generations.set(playerId, generation);
		this.disposeRoots(playerId);
	}

	attachWeapon(
		playerId: string,
		player: BABYLON.AbstractMesh,
		weapon: WeaponKind,
	): void {
		if (!isVisibleWeapon(weapon)) return;
		if (this.weaponRoots.get(playerId)?.has(weapon)) return;
		const generation = this.generations.get(playerId);
		if (generation === undefined) return;
		void this.attach(weapon, playerId, player, generation);
	}

	removePlayer(playerId: string): void {
		this.generations.set(playerId, (this.generations.get(playerId) ?? 0) + 1);
		this.disposeRoots(playerId);
	}

	playAttack(playerId: string, weapon: WeaponKind): void {
		if (!isVisibleWeapon(weapon)) return;
		const root = this.weaponRoots.get(playerId)?.get(weapon);
		if (!root || root.isDisposed()) return;
		const config = ATTACK_ANIMATIONS[weapon];
		const easing = new BABYLON.QuadraticEase();
		easing.setEasingMode(config.easingMode);
		const animation = this.floatAnimation(
			`${config.name}:${playerId}`,
			config.property,
			config.keys,
			easing,
		);
		root.getScene().stopAnimation(root);
		root.getScene().beginDirectAnimation(
			root,
			[animation],
			0,
			config.endFrame,
			false,
			1,
			() => {
				if (!root.isDisposed()) config.reset(root);
			},
		);
	}

	private floatAnimation(
		name: string,
		property: string,
		keys: ReadonlyArray<readonly [frame: number, value: number]>,
		easing: BABYLON.EasingFunction,
	): BABYLON.Animation {
		const animation = new BABYLON.Animation(
			name,
			property,
			60,
			BABYLON.Animation.ANIMATIONTYPE_FLOAT,
			BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
		);
		animation.setKeys(keys.map(([frame, value]) => ({ frame, value })));
		animation.setEasingFunction(easing);
		return animation;
	}

	dispose(): void {
		this.disposed = true;
		this.generations.clear();
		this.roots.forEach((roots) => roots.forEach((root) => root.dispose()));
		this.roots.clear();
		this.weaponRoots.clear();
	}

	private async attach(
		weapon: VisibleWeapon,
		playerId: string,
		player: BABYLON.AbstractMesh,
		generation: number,
	): Promise<void> {
		const modelRoot = await this.assets.instantiate(
			weapon,
			`${weapon}:${playerId}`,
		);
		if (
			this.disposed ||
			player.isDisposed() ||
			this.generations.get(playerId) !== generation
		) {
			modelRoot.dispose();
			return;
		}
		const transform = weaponModels[weapon].attachment;
		if (!transform) {
			modelRoot.dispose();
			return;
		}
		let root = modelRoot;
		if (weapon === 'sword') {
			// Le GLB place la longueur de l'epee sur Y. Le modele est couche sur le
			// plan XZ et decale jusqu'a ce que son pommeau coincide avec le pivot.
			// Seul ce pivot tourne pendant l'attaque : sa position ne bouge jamais.
			root = new BABYLON.TransformNode(
				`swordPivot:${playerId}`,
				modelRoot.getScene(),
			);
			modelRoot.parent = root;
			modelRoot.rotationQuaternion = null;
			modelRoot.position.set(0, 0, SWORD_POMMEL_OFFSET);
			// Le modele charge pointe sur Y ; +PI/2 couche la lame vers +Z, qui est
			// exactement l'avant utilise par les mouvements et les degats serveur.
			modelRoot.rotation.set(Math.PI / 2, 0, 0);
		} else if (weapon === 'bow') {
			// Le GLB vit dans le plan XY. Cette double rotation le place dans XZ :
			// ses branches restent gauche/droite et sa courbure pointe vers +Z.
			root = new BABYLON.TransformNode(
				`bowPivot:${playerId}`,
				modelRoot.getScene(),
			);
			modelRoot.parent = root;
			modelRoot.rotationQuaternion = null;
			modelRoot.rotation.set(
				BOW_HORIZONTAL_PITCH,
				0,
				BOW_HORIZONTAL_ROLL,
			);
		}
		root.rotationQuaternion = null;
		root.parent = player;
		root.position.set(...transform.position);
		if (weapon === 'sword') root.rotation.set(0, SWORD_REST_YAW, 0);
		else root.rotation.set(...transform.rotation);
		root.scaling.setAll(transform.scale);
		const weaponRoots = this.weaponRoots.get(playerId) ?? new Map();
		weaponRoots.set(weapon, root);
		this.weaponRoots.set(playerId, weaponRoots);
		const roots = this.roots.get(playerId) ?? [];
		roots.push(root);
		this.roots.set(playerId, roots);
	}

	private disposeRoots(playerId: string): void {
		this.roots.get(playerId)?.forEach((root) => root.dispose());
		this.roots.delete(playerId);
		this.weaponRoots.delete(playerId);
	}
}
