import { describe, it, expect } from 'vitest';
import { Vec3 } from './Vec3';

describe('Vec3', () => {
	it('creates a vector from x,y,z', () => {
		const v = Vec3.of(1, 2, 3);
		expect(v.x).toBe(1);
		expect(v.y).toBe(2);
		expect(v.z).toBe(3);
	});

	it('zero returns the origin', () => {
		expect(Vec3.zero()).toEqual({ x: 0, y: 0, z: 0 });
	});

	it('add returns the component-wise sum', () => {
		expect(Vec3.add(Vec3.of(1, 2, 3), Vec3.of(4, 5, 6))).toEqual({ x: 5, y: 7, z: 9 });
	});

	it('subtract returns the component-wise difference', () => {
		expect(Vec3.subtract(Vec3.of(5, 7, 9), Vec3.of(1, 2, 3))).toEqual({ x: 4, y: 5, z: 6 });
	});

	it('scale multiplies each component by a scalar', () => {
		expect(Vec3.scale(Vec3.of(1, 2, 3), 2)).toEqual({ x: 2, y: 4, z: 6 });
	});

	it('length returns the euclidean norm', () => {
		expect(Vec3.length(Vec3.of(3, 0, 4))).toBe(5);
	});

	it('lengthSquared returns the squared norm without sqrt', () => {
		expect(Vec3.lengthSquared(Vec3.of(3, 0, 4))).toBe(25);
	});

	it('normalize returns a unit vector', () => {
		const n = Vec3.normalize(Vec3.of(3, 0, 4));
		expect(Vec3.length(n)).toBeCloseTo(1);
		expect(n.x).toBeCloseTo(0.6);
		expect(n.z).toBeCloseTo(0.8);
	});

	it('normalize returns zero for the zero vector', () => {
		expect(Vec3.normalize(Vec3.zero())).toEqual({ x: 0, y: 0, z: 0 });
	});

	it('flattenY zeros the y component', () => {
		expect(Vec3.flattenY(Vec3.of(1, 5, 2))).toEqual({ x: 1, y: 0, z: 2 });
	});
});
