import {
	Color3, Mesh, MeshBuilder, Quaternion, Scene, StandardMaterial, Vector3,
} from '@babylonjs/core';
import type { TerrainGenerator } from '../world/TerrainGenerator';

export interface MonsterDimensions {
	width: number;
	height: number;
}

export class Monster {
	private readonly _mesh: Mesh;
	private readonly _terrain: TerrainGenerator;
	private readonly _dimensions: MonsterDimensions;
	private _lastAttackTime: number;

	constructor(
		scene: Scene,
		terrain: TerrainGenerator,
		dimensions: MonsterDimensions,
		id: number,
		spawnX: number,
		spawnZ: number,
		attackCooldown: number,
	) {
		this._terrain = terrain;
		this._dimensions = dimensions;

		const mesh = MeshBuilder.CreateBox(`monster_${id}`, {
			width: dimensions.width,
			height: dimensions.height,
			depth: dimensions.width,
		}, scene);

		const mat = new StandardMaterial('monsterMat', scene);
		mat.diffuseColor = new Color3(1, 0.5, 0);
		mesh.material = mat;

		const groundY = terrain.getHeightAt(spawnX, spawnZ);
		mesh.position = new Vector3(spawnX, groundY + dimensions.height / 2, spawnZ);
		this._mesh = mesh;

		this._lastAttackTime = Date.now() - attackCooldown;
	}

	get mesh(): Mesh {
		return this._mesh;
	}

	get position(): Vector3 {
		return this._mesh.position;
	}

	get lastAttackTime(): number {
		return this._lastAttackTime;
	}

	markAttack(time: number): void {
		this._lastAttackTime = time;
	}

	moveBy(deltaX: number, deltaZ: number): void {
		this._mesh.position.x += deltaX;
		this._mesh.position.z += deltaZ;
		const ground = this._terrain.getHeightAt(this._mesh.position.x, this._mesh.position.z);
		this._mesh.position.y = ground + this._dimensions.height / 2;

		if (deltaX !== 0 || deltaZ !== 0) {
			const yaw = -Math.atan2(deltaZ, deltaX) + Math.PI / 2;
			this._mesh.rotationQuaternion = Quaternion.RotationYawPitchRoll(yaw, 0, 0);
		}
	}

	dispose(): void {
		this._mesh.dispose();
	}
}
