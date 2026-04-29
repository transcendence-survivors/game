import { describe, it, expect } from 'vitest';
import { HitDetector } from './HitDetector';
import { Vec3 } from '../math/Vec3';

describe('HitDetector', () => {
	const detector = new HitDetector({ range: 3, halfAngleRad: Math.PI / 4 });

	it('hits a target directly in front within range', () => {
		const center = Vec3.zero();
		const forward = Vec3.of(1, 0, 0);
		const targets = [Vec3.of(2, 0, 0)];
		expect(detector.computeHits(center, forward, targets)).toEqual([0]);
	});

	it('misses a target out of range', () => {
		const center = Vec3.zero();
		const forward = Vec3.of(1, 0, 0);
		const targets = [Vec3.of(10, 0, 0)];
		expect(detector.computeHits(center, forward, targets)).toEqual([]);
	});

	it('misses a target behind the player', () => {
		const center = Vec3.zero();
		const forward = Vec3.of(1, 0, 0);
		const targets = [Vec3.of(-2, 0, 0)];
		expect(detector.computeHits(center, forward, targets)).toEqual([]);
	});

	it('misses a target outside the cone', () => {
		const center = Vec3.zero();
		const forward = Vec3.of(1, 0, 0);
		const targets = [Vec3.of(0, 0, 2)];
		expect(detector.computeHits(center, forward, targets)).toEqual([]);
	});

	it('hits a target inside the cone', () => {
		const center = Vec3.zero();
		const forward = Vec3.of(1, 0, 0);
		const targets = [Vec3.of(2, 0, 0.5)];
		expect(detector.computeHits(center, forward, targets)).toEqual([0]);
	});

	it('returns all hit indices', () => {
		const center = Vec3.zero();
		const forward = Vec3.of(1, 0, 0);
		const targets = [
			Vec3.of(1, 0, 0),
			Vec3.of(-1, 0, 0),
			Vec3.of(2, 0, 0.3),
			Vec3.of(0, 0, 5),
		];
		expect(detector.computeHits(center, forward, targets)).toEqual([0, 2]);
	});

	it('ignores Y axis (planar cone)', () => {
		const center = Vec3.zero();
		const forward = Vec3.of(1, 0, 0);
		const targets = [Vec3.of(2, 100, 0)];
		expect(detector.computeHits(center, forward, targets)).toEqual([0]);
	});

	it('treats overlapping target as hit', () => {
		const center = Vec3.zero();
		const forward = Vec3.of(1, 0, 0);
		const targets = [Vec3.zero()];
		expect(detector.computeHits(center, forward, targets)).toEqual([0]);
	});
});
