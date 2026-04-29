import { describe, it, expect } from 'vitest';
import { DifficultyCurve } from './DifficultyCurve';

describe('DifficultyCurve', () => {
	const curve = new DifficultyCurve({
		baseMaxMonsters: 5,
		monstersPerMinute: 20,
		hardCapMonsters: 80,
		baseSpawnIntervalMs: 2000,
		minSpawnIntervalMs: 200,
		spawnIntervalDecayPerSecondMs: 10,
		unlocks: [
			{ typeId: 'goblin', timeMs: 0 },
			{ typeId: 'wolf', timeMs: 30_000 },
			{ typeId: 'orc', timeMs: 90_000 },
			{ typeId: 'demon', timeMs: 180_000 },
		],
	});

	describe('maxMonstersAt', () => {
		it('returns the base value at t=0', () => {
			expect(curve.maxMonstersAt(0)).toBe(5);
		});

		it('grows with elapsed time', () => {
			expect(curve.maxMonstersAt(60_000)).toBeGreaterThan(curve.maxMonstersAt(0));
			expect(curve.maxMonstersAt(180_000)).toBeGreaterThan(curve.maxMonstersAt(60_000));
		});

		it('caps at the hard cap', () => {
			expect(curve.maxMonstersAt(60 * 60 * 1000)).toBe(80);
		});

		it('returns integer values', () => {
			expect(Number.isInteger(curve.maxMonstersAt(45_000))).toBe(true);
		});
	});

	describe('spawnIntervalAt', () => {
		it('returns base value at t=0', () => {
			expect(curve.spawnIntervalAt(0)).toBe(2000);
		});

		it('decreases over time', () => {
			expect(curve.spawnIntervalAt(60_000)).toBeLessThan(curve.spawnIntervalAt(0));
		});

		it('cannot go below the floor', () => {
			expect(curve.spawnIntervalAt(60 * 60 * 1000)).toBe(200);
		});
	});

	describe('unlockedTypeIdsAt', () => {
		it('returns only the goblin at t=0', () => {
			expect(curve.unlockedTypeIdsAt(0)).toEqual(['goblin']);
		});

		it('unlocks wolf at 30s', () => {
			expect(curve.unlockedTypeIdsAt(30_000)).toContain('wolf');
		});

		it('does not include locked types', () => {
			expect(curve.unlockedTypeIdsAt(60_000)).not.toContain('orc');
			expect(curve.unlockedTypeIdsAt(60_000)).not.toContain('demon');
		});

		it('unlocks all when far enough', () => {
			const all = curve.unlockedTypeIdsAt(300_000);
			expect(all).toEqual(['goblin', 'wolf', 'orc', 'demon']);
		});
	});
});
