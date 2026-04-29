import { describe, it, expect } from 'vitest';
import { TerrainGenerator } from './TerrainGenerator';

describe('TerrainGenerator', () => {
	const tileSize = 1;
	const generator = new TerrainGenerator(tileSize);

	describe('getVoxelHeight', () => {
		it('returns an integer (rounded) value', () => {
			const h = generator.getVoxelHeight(5, 7);
			expect(Number.isInteger(h)).toBe(true);
		});

		it('is deterministic for the same coordinates', () => {
			expect(generator.getVoxelHeight(10, 20)).toBe(generator.getVoxelHeight(10, 20));
			expect(generator.getVoxelHeight(-3, 4)).toBe(generator.getVoxelHeight(-3, 4));
		});

		it('returns a finite value at the origin (phase offsets prevent exact zero)', () => {
			const h = generator.getVoxelHeight(0, 0);
			expect(Number.isFinite(h)).toBe(true);
		});

		it('produces values within the expected amplitude band', () => {
			for (let x = -50; x <= 50; x += 5) {
				for (let z = -50; z <= 50; z += 5) {
					const h = generator.getVoxelHeight(x, z);
					expect(h).toBeGreaterThanOrEqual(-18);
					expect(h).toBeLessThanOrEqual(18);
				}
			}
		});
	});

	describe('getHeightAt', () => {
		it('multiplies the voxel height by the tile size', () => {
			const gen2 = new TerrainGenerator(2);
			const grid = gen2.getVoxelHeight(4, 6);
			expect(gen2.getHeightAt(4 * 2, 6 * 2)).toBe(grid * 2);
		});

		it('rounds world coordinates to grid coordinates', () => {
			expect(generator.getHeightAt(3.4, 7.6)).toBe(generator.getVoxelHeight(3, 8));
		});
	});

	describe('getMaxHeightAround', () => {
		it('returns the max height of the four corners', () => {
			const x = 5;
			const z = 10;
			const r = 0.5;
			const expected = Math.max(
				generator.getHeightAt(x + r, z + r),
				generator.getHeightAt(x - r, z + r),
				generator.getHeightAt(x + r, z - r),
				generator.getHeightAt(x - r, z - r),
			);
			expect(generator.getMaxHeightAround(x, z, r)).toBe(expected);
		});
	});
});
