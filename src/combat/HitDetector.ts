import { Vec3 } from '../math/Vec3';
import type { IVec3 } from '../math/Vec3';

export interface HitDetectorConfig {
	range: number;
	halfAngleRad: number;
}

export class HitDetector {
	private readonly _config: HitDetectorConfig;

	constructor(config: HitDetectorConfig) {
		this._config = config;
	}

	get config(): HitDetectorConfig {
		return this._config;
	}

	computeHits(center: IVec3, forward: IVec3, targets: IVec3[]): number[] {
		const flatForward = Vec3.normalize(Vec3.flattenY(forward));
		const cosHalf = Math.cos(this._config.halfAngleRad);
		const rangeSq = this._config.range * this._config.range;
		const result: number[] = [];

		for (let i = 0; i < targets.length; i++) {
			const diff = Vec3.flattenY(Vec3.subtract(targets[i], center));
			const distSq = Vec3.lengthSquared(diff);

			if (distSq > rangeSq) continue;
			if (distSq === 0) {
				result.push(i);
				continue;
			}

			const dirToTarget = Vec3.normalize(diff);
			const dot = dirToTarget.x * flatForward.x + dirToTarget.z * flatForward.z;
			if (dot >= cosHalf) result.push(i);
		}
		return result;
	}
}
