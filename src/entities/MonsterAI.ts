import { Vec3 } from '../math/Vec3';
import type { IVec3 } from '../math/Vec3';

export interface MonsterAIConfig {
	attackRange: number;
	monsterRadius: number;
	separationWeight: number;
	stoppingDistance: number;
}

export class MonsterAI {
	private readonly _config: MonsterAIConfig;

	constructor(config: MonsterAIConfig) {
		this._config = config;
	}

	get config(): MonsterAIConfig {
		return this._config;
	}

	computeMoveDirection(self: IVec3, player: IVec3, peers: IVec3[]): IVec3 {
		const toPlayer = Vec3.flattenY(Vec3.subtract(player, self));
		const distance = Vec3.length(toPlayer);

		let move = Vec3.zero();

		if (distance > this._config.stoppingDistance) {
			move = Vec3.add(move, Vec3.normalize(toPlayer));
		}

		const separation = this._computeSeparation(self, peers);
		move = Vec3.add(move, Vec3.scale(separation, this._config.separationWeight));

		if (Vec3.lengthSquared(move) === 0) return Vec3.zero();
		return Vec3.normalize(Vec3.flattenY(move));
	}

	isInAttackRange(self: IVec3, player: IVec3): boolean {
		const horizontal = Vec3.flattenY(Vec3.subtract(player, self));
		return Vec3.length(horizontal) <= this._config.attackRange;
	}

	private _computeSeparation(self: IVec3, peers: IVec3[]): IVec3 {
		const minDistance = this._config.monsterRadius * 2;
		let result = Vec3.zero();

		for (const peer of peers) {
			const diff = Vec3.flattenY(Vec3.subtract(self, peer));
			const dist = Vec3.length(diff);

			if (dist > 0 && dist < minDistance) {
				const pushForce = (minDistance - dist) / minDistance;
				result = Vec3.add(result, Vec3.scale(Vec3.normalize(diff), pushForce));
			}
		}

		return result;
	}
}
