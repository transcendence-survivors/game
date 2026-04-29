import { describe, it, expect } from 'vitest';
import { MonsterCatalog } from './MonsterCatalog';
import type { MonsterType } from './MonsterType';

const goblin: MonsterType = {
	id: 'goblin',
	color: { r: 1, g: 0.5, b: 0 },
	maxHp: 100,
	damage: 5,
	speed: 0.06,
	width: 0.8,
	height: 1.8,
	radius: 0.7,
	attackRange: 2.0,
	attackCooldownMs: 1000,
	spawnWeight: 1,
};

const wolf: MonsterType = {
	id: 'wolf',
	color: { r: 0.4, g: 0.4, b: 0.7 },
	maxHp: 60,
	damage: 8,
	speed: 0.10,
	width: 0.6,
	height: 1.0,
	radius: 0.5,
	attackRange: 1.8,
	attackCooldownMs: 800,
	spawnWeight: 0.6,
};

const orc: MonsterType = {
	id: 'orc',
	color: { r: 0.7, g: 0.2, b: 0.2 },
	maxHp: 250,
	damage: 12,
	speed: 0.04,
	width: 1.0,
	height: 2.2,
	radius: 0.9,
	attackRange: 2.5,
	attackCooldownMs: 1200,
	spawnWeight: 0.3,
};

describe('MonsterCatalog', () => {
	const catalog = new MonsterCatalog([goblin, wolf, orc]);

	describe('getById', () => {
		it('retrieves a known type', () => {
			expect(catalog.getById('wolf')).toEqual(wolf);
		});

		it('throws for an unknown id', () => {
			expect(() => catalog.getById('dragon')).toThrow();
		});
	});

	describe('pickRandom', () => {
		it('throws when no ids are unlocked', () => {
			expect(() => catalog.pickRandom([], () => 0.5)).toThrow();
		});

		it('returns the only unlocked type if list has one element', () => {
			expect(catalog.pickRandom(['goblin'], () => 0.5).id).toBe('goblin');
		});

		it('returns one of the unlocked types', () => {
			const ids: string[] = [];
			let r = 0;
			for (let i = 0; i < 30; i++) {
				ids.push(catalog.pickRandom(['goblin', 'wolf'], () => { r = (r + 0.137) % 1; return r; }).id);
			}
			expect(ids.every(id => id === 'goblin' || id === 'wolf')).toBe(true);
		});

		it('respects weights deterministically with controlled rng', () => {
			const first = catalog.pickRandom(['goblin', 'wolf'], () => 0);
			expect(first.id).toBe('goblin');

			const last = catalog.pickRandom(['goblin', 'wolf'], () => 0.99);
			expect(last.id).toBe('wolf');
		});

		it('ignores types not in the unlocked list', () => {
			for (let r = 0; r < 1; r += 0.05) {
				const t = catalog.pickRandom(['orc'], () => r);
				expect(t.id).toBe('orc');
			}
		});
	});
});
