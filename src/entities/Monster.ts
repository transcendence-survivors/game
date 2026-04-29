import {
	Color3, Mesh, MeshBuilder, Quaternion, Scene, StandardMaterial, Vector3,
} from '@babylonjs/core';
import type { TerrainGenerator } from '../world/TerrainGenerator';
import { HealthSystem } from '../systems/HealthSystem';
import { MonsterHealthBar } from './MonsterHealthBar';
import { MonsterFlashEffect } from './MonsterFlashEffect';

export interface MonsterDimensions {
	width: number;
	height: number;
}

export interface MonsterConfig {
	id: number;
	dimensions: MonsterDimensions;
	spawnX: number;
	spawnZ: number;
	maxHp: number;
	attackCooldownMs: number;
	flashDurationMs: number;
}

export class Monster {
	private readonly _mesh: Mesh;
	private readonly _terrain: TerrainGenerator;
	private readonly _dimensions: MonsterDimensions;
	private readonly _health: HealthSystem;
	private readonly _hpBar: MonsterHealthBar;
	private readonly _flash: MonsterFlashEffect;
	private _lastAttackTime: number;
	private _disposed: boolean = false;

	constructor(scene: Scene, terrain: TerrainGenerator, config: MonsterConfig) {
		this._terrain = terrain;
		this._dimensions = config.dimensions;

		const mesh = MeshBuilder.CreateBox(`monster_${config.id}`, {
			width: config.dimensions.width,
			height: config.dimensions.height,
			depth: config.dimensions.width,
		}, scene);

		const mat = new StandardMaterial(`monsterMat_${config.id}`, scene);
		mat.diffuseColor = new Color3(1, 0.5, 0);
		mesh.material = mat;

		const groundY = terrain.getHeightAt(config.spawnX, config.spawnZ);
		mesh.position = new Vector3(config.spawnX, groundY + config.dimensions.height / 2, config.spawnZ);
		this._mesh = mesh;

		this._health = new HealthSystem(config.maxHp);
		this._flash = new MonsterFlashEffect(mat, {
			flashColor: new Color3(1, 0, 0),
			durationMs: config.flashDurationMs,
		});

		this._hpBar = new MonsterHealthBar(scene, mesh, {
			width: config.dimensions.width * 1.5,
			height: 0.18,
			heightOffset: config.dimensions.height / 2 + 0.4,
		});

		this._lastAttackTime = Date.now() - config.attackCooldownMs;
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

	get isDead(): boolean {
		return this._health.isDead;
	}

	get isDisposed(): boolean {
		return this._disposed;
	}

	markAttack(time: number): void {
		this._lastAttackTime = time;
	}

	takeDamage(amount: number, nowMs: number): void {
		if (this._health.isDead) return;
		this._health.damage(amount);
		this._flash.trigger(nowMs);
		this._hpBar.setRatio(this._health.ratio);
	}

	tick(nowMs: number): void {
		this._flash.update(nowMs);
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
		if (this._disposed) return;
		this._disposed = true;
		this._hpBar.dispose();
		this._mesh.dispose();
	}
}
