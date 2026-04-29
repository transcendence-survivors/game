import {
	Color3, Mesh, MeshBuilder, Quaternion, Scene, StandardMaterial, Vector3,
} from '@babylonjs/core';
import type { TerrainGenerator } from '../world/TerrainGenerator';
import { HealthSystem } from '../systems/HealthSystem';
import { MonsterHealthBar } from './MonsterHealthBar';
import { MonsterFlashEffect } from './MonsterFlashEffect';
import { MonsterAI } from './MonsterAI';
import type { MonsterType } from '../difficulty/MonsterType';
import { Vec3 } from '../math/Vec3';
import type { IVec3 } from '../math/Vec3';

export interface MonsterBehavior {
	stoppingDistance: number;
	separationWeight: number;
}

export interface MonsterConfig {
	id: number;
	type: MonsterType;
	spawnX: number;
	spawnZ: number;
	flashDurationMs: number;
	behavior: MonsterBehavior;
}

export class Monster {
	private readonly _mesh: Mesh;
	private readonly _terrain: TerrainGenerator;
	private readonly _type: MonsterType;
	private readonly _health: HealthSystem;
	private readonly _hpBar: MonsterHealthBar;
	private readonly _flash: MonsterFlashEffect;
	private readonly _ai: MonsterAI;
	private _lastAttackTime: number;
	private _disposed: boolean = false;

	constructor(scene: Scene, terrain: TerrainGenerator, config: MonsterConfig) {
		this._terrain = terrain;
		this._type = config.type;

		const mesh = MeshBuilder.CreateBox(`monster_${config.type.id}_${config.id}`, {
			width: config.type.width,
			height: config.type.height,
			depth: config.type.width,
		}, scene);

		const mat = new StandardMaterial(`monsterMat_${config.id}`, scene);
		mat.diffuseColor = new Color3(config.type.color.r, config.type.color.g, config.type.color.b);
		mesh.material = mat;

		const groundY = terrain.getHeightAt(config.spawnX, config.spawnZ);
		mesh.position = new Vector3(config.spawnX, groundY + config.type.height / 2, config.spawnZ);
		this._mesh = mesh;

		this._health = new HealthSystem(config.type.maxHp);
		this._flash = new MonsterFlashEffect(mat, {
			flashColor: new Color3(1, 0, 0),
			durationMs: config.flashDurationMs,
		});

		this._hpBar = new MonsterHealthBar(scene, mesh, {
			width: config.type.width * 1.5,
			height: 0.18,
			heightOffset: config.type.height / 2 + 0.4,
		});

		this._ai = new MonsterAI({
			attackRange: config.type.attackRange,
			monsterRadius: config.type.radius,
			separationWeight: config.behavior.separationWeight,
			stoppingDistance: config.behavior.stoppingDistance,
		});

		this._lastAttackTime = Date.now() - config.type.attackCooldownMs;
	}

	computeMove(playerPosition: IVec3, peerPositions: IVec3[]): IVec3 {
		return this._ai.computeMoveDirection(this._asVec(), playerPosition, peerPositions);
	}

	isInAttackRange(playerPosition: IVec3): boolean {
		return this._ai.isInAttackRange(this._asVec(), playerPosition);
	}

	private _asVec(): IVec3 {
		return Vec3.of(this._mesh.position.x, this._mesh.position.y, this._mesh.position.z);
	}

	get mesh(): Mesh {
		return this._mesh;
	}

	get position(): Vector3 {
		return this._mesh.position;
	}

	get type(): MonsterType {
		return this._type;
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
		this._mesh.position.y = ground + this._type.height / 2;

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
