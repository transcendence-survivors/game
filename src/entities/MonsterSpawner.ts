import { Scene, Vector3 } from '@babylonjs/core';
import { Monster } from './Monster';
import type { MonsterBehavior } from './Monster';
import { Vec3 } from '@transcendence/game-shared';
import type {
	IVec3, TerrainGenerator, HealthSystem, DifficultyCurve, MonsterCatalog,
} from '@transcendence/game-shared';

export interface MonsterSpawnerConfig {
	minSpawnRadius: number;
	maxSpawnRadius: number;
	flashDurationMs: number;
	behavior: MonsterBehavior;
}

export class MonsterSpawner {
	private readonly _scene: Scene;
	private readonly _terrain: TerrainGenerator;
	private readonly _config: MonsterSpawnerConfig;
	private readonly _curve: DifficultyCurve;
	private readonly _catalog: MonsterCatalog;
	private readonly _monsters: Monster[] = [];

	private _spawnTimer: number = 0;
	private _nextId: number = 0;
	private _maxAtCurrentTime: number = 0;

	constructor(
		scene: Scene,
		terrain: TerrainGenerator,
		config: MonsterSpawnerConfig,
		curve: DifficultyCurve,
		catalog: MonsterCatalog,
	) {
		this._scene = scene;
		this._terrain = terrain;
		this._config = config;
		this._curve = curve;
		this._catalog = catalog;
	}

	get count(): number {
		return this._monsters.length;
	}

	get max(): number {
		return this._maxAtCurrentTime;
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

	update(deltaTimeMs: number, nowMs: number, elapsedMs: number, playerPosition: Vector3, health: HealthSystem): void {
		this._maxAtCurrentTime = this._curve.maxMonstersAt(elapsedMs);
		this._handleSpawn(deltaTimeMs, elapsedMs, playerPosition);
		this._tickMonsters(nowMs);
		this._handleMovement(playerPosition, health);
		this._reapDead();
	}

	private _handleSpawn(deltaTimeMs: number, elapsedMs: number, playerPosition: Vector3): void {
		if (this._monsters.length >= this._maxAtCurrentTime) return;

		this._spawnTimer += deltaTimeMs;
		const interval = this._curve.spawnIntervalAt(elapsedMs);
		if (this._spawnTimer < interval) return;
		this._spawnTimer = 0;

		const unlocked = this._curve.unlockedTypeIdsAt(elapsedMs);
		if (unlocked.length === 0) return;
		const type = this._catalog.pickRandom(unlocked);

		const radius = this._config.minSpawnRadius
			+ Math.random() * (this._config.maxSpawnRadius - this._config.minSpawnRadius);
		const angle = Math.random() * Math.PI * 2;
		const spawnX = playerPosition.x + Math.cos(angle) * radius;
		const spawnZ = playerPosition.z + Math.sin(angle) * radius;

		const monster = new Monster(this._scene, this._terrain, {
			id: this._nextId++,
			type,
			spawnX,
			spawnZ,
			flashDurationMs: this._config.flashDurationMs,
			behavior: this._config.behavior,
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
			const otherPeers = peerPositions.filter((_, j) => j !== i);

			const direction = monster.computeMove(playerVec, otherPeers);
			const moveX = direction.x * monster.type.speed;
			const moveZ = direction.z * monster.type.speed;

			if (moveX !== 0 || moveZ !== 0) monster.moveBy(moveX, moveZ);

			if (monster.isInAttackRange(playerVec)) {
				const now = Date.now();
				if (now - monster.lastAttackTime >= monster.type.attackCooldownMs) {
					monster.markAttack(now);
					health.damage(monster.type.damage);
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
