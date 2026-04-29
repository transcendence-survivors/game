import { Scene, Vector3 } from '@babylonjs/core';
import { Monster } from './Monster';
import type { TerrainGenerator } from '../world/TerrainGenerator';
import { MonsterAI } from './MonsterAI';
import type { HealthSystem } from '../systems/HealthSystem';
import { Vec3 } from '../math/Vec3';
import type { IVec3 } from '../math/Vec3';

export interface MonsterSpawnerConfig {
	maxCount: number;
	spawnIntervalMs: number;
	minSpawnRadius: number;
	maxSpawnRadius: number;
	width: number;
	height: number;
	radius: number;
	speed: number;
	damage: number;
	maxHp: number;
	attackRange: number;
	attackCooldownMs: number;
	stoppingDistance: number;
	separationWeight: number;
	flashDurationMs: number;
}

export class MonsterSpawner {
	private readonly _scene: Scene;
	private readonly _terrain: TerrainGenerator;
	private readonly _config: MonsterSpawnerConfig;
	private readonly _ai: MonsterAI;
	private readonly _monsters: Monster[] = [];

	private _spawnTimer: number = 0;
	private _nextId: number = 0;

	constructor(scene: Scene, terrain: TerrainGenerator, config: MonsterSpawnerConfig) {
		this._scene = scene;
		this._terrain = terrain;
		this._config = config;

		this._ai = new MonsterAI({
			attackRange: config.attackRange,
			monsterRadius: config.radius,
			separationWeight: config.separationWeight,
			stoppingDistance: config.stoppingDistance,
		});
	}

	get count(): number {
		return this._monsters.length;
	}

	get max(): number {
		return this._config.maxCount;
	}

	get monsters(): readonly Monster[] {
		return this._monsters;
	}

	getPositions(): IVec3[] {
		return this._monsters.map(m => Vec3.of(m.position.x, m.position.y, m.position.z));
	}

	damageInRange(indices: readonly number[], amount: number, nowMs: number): void {
		for (const i of indices) {
			const monster = this._monsters[i];
			if (monster && !monster.isDead) monster.takeDamage(amount, nowMs);
		}
	}

	update(deltaTimeMs: number, nowMs: number, playerPosition: Vector3, health: HealthSystem): void {
		this._handleSpawn(deltaTimeMs, playerPosition);
		this._tickMonsters(nowMs);
		this._handleMovement(playerPosition, health);
		this._reapDead();
	}

	private _handleSpawn(deltaTimeMs: number, playerPosition: Vector3): void {
		if (this._monsters.length >= this._config.maxCount) return;
		this._spawnTimer += deltaTimeMs;
		if (this._spawnTimer < this._config.spawnIntervalMs) return;

		this._spawnTimer = 0;
		const radius = this._config.minSpawnRadius
			+ Math.random() * (this._config.maxSpawnRadius - this._config.minSpawnRadius);
		const angle = Math.random() * Math.PI * 2;
		const spawnX = playerPosition.x + Math.cos(angle) * radius;
		const spawnZ = playerPosition.z + Math.sin(angle) * radius;

		const monster = new Monster(this._scene, this._terrain, {
			id: this._nextId++,
			dimensions: { width: this._config.width, height: this._config.height },
			spawnX,
			spawnZ,
			maxHp: this._config.maxHp,
			attackCooldownMs: this._config.attackCooldownMs,
			flashDurationMs: this._config.flashDurationMs,
		});
		this._monsters.push(monster);
	}

	private _tickMonsters(nowMs: number): void {
		for (const m of this._monsters) m.tick(nowMs);
	}

	private _handleMovement(playerPosition: Vector3, health: HealthSystem): void {
		const playerVec = Vec3.of(playerPosition.x, playerPosition.y, playerPosition.z);
		const peerPositions = this.getPositions();

		for (let i = 0; i < this._monsters.length; i++) {
			const monster = this._monsters[i];
			if (monster.isDead) continue;
			const selfVec = peerPositions[i];
			const otherPeers = peerPositions.filter((_, j) => j !== i);

			const direction = this._ai.computeMoveDirection(selfVec, playerVec, otherPeers);
			const moveX = direction.x * this._config.speed;
			const moveZ = direction.z * this._config.speed;

			if (moveX !== 0 || moveZ !== 0) monster.moveBy(moveX, moveZ);

			if (this._ai.isInAttackRange(selfVec, playerVec)) {
				const now = Date.now();
				if (now - monster.lastAttackTime >= this._config.attackCooldownMs) {
					monster.markAttack(now);
					health.damage(this._config.damage);
				}
			}
		}
	}

	private _reapDead(): void {
		for (let i = this._monsters.length - 1; i >= 0; i--) {
			if (this._monsters[i].isDead) {
				this._monsters[i].dispose();
				this._monsters.splice(i, 1);
			}
		}
	}
}
