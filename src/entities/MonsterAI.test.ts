import { describe, it, expect } from 'vitest';
import { MonsterAI } from './MonsterAI';
import { Vec3 } from '../math/Vec3';

describe('MonsterAI', () => {
	const ai = new MonsterAI({
		attackRange: 2.0,
		monsterRadius: 0.7,
		separationWeight: 1.5,
		stoppingDistance: 1.1,
	});

	describe('computeMoveDirection', () => {
		it('returns zero when on top of the player and no peers', () => {
			const result = ai.computeMoveDirection(Vec3.zero(), Vec3.zero(), []);
			expect(result).toEqual(Vec3.zero());
		});

		it('points toward the player when far away on the X axis', () => {
			const self = Vec3.of(0, 0, 0);
			const player = Vec3.of(10, 0, 0);
			const dir = ai.computeMoveDirection(self, player, []);
			expect(dir.x).toBeCloseTo(1);
			expect(dir.y).toBe(0);
			expect(dir.z).toBeCloseTo(0);
		});

		it('returned vector has length ≤ 1 (or is zero)', () => {
			const dir = ai.computeMoveDirection(Vec3.of(0, 0, 0), Vec3.of(5, 0, 5), []);
			expect(Vec3.length(dir)).toBeLessThanOrEqual(1.0001);
		});

		it('does not move toward player when within stopping distance', () => {
			const self = Vec3.of(0, 0, 0);
			const player = Vec3.of(0.5, 0, 0);
			const dir = ai.computeMoveDirection(self, player, []);
			expect(Vec3.length(dir)).toBe(0);
		});

		it('separation pushes laterally when a peer is offset from the path to player', () => {
			const self = Vec3.of(0, 0, 0);
			const player = Vec3.of(100, 0, 0);
			const peer = Vec3.of(0, 0, 0.5);
			const dir = ai.computeMoveDirection(self, player, [peer]);
			expect(dir.z).toBeLessThan(0);
		});

		it('ignores peers outside the combined hitbox radius', () => {
			const self = Vec3.of(0, 0, 0);
			const player = Vec3.of(10, 0, 0);
			const farPeer = Vec3.of(0, 0, 50);
			const dir = ai.computeMoveDirection(self, player, [farPeer]);
			expect(dir.x).toBeCloseTo(1);
			expect(dir.z).toBeCloseTo(0);
		});

		it('output has y=0 (movement on horizontal plane)', () => {
			const self = Vec3.of(0, 5, 0);
			const player = Vec3.of(10, -5, 5);
			const dir = ai.computeMoveDirection(self, player, []);
			expect(dir.y).toBe(0);
		});
	});

	describe('isInAttackRange', () => {
		it('returns true when distance <= attackRange', () => {
			expect(ai.isInAttackRange(Vec3.zero(), Vec3.of(1.5, 0, 0))).toBe(true);
		});

		it('ignores Y when computing horizontal distance', () => {
			expect(ai.isInAttackRange(Vec3.of(0, 0, 0), Vec3.of(1, 100, 1))).toBe(true);
		});

		it('returns false beyond attack range', () => {
			expect(ai.isInAttackRange(Vec3.zero(), Vec3.of(5, 0, 0))).toBe(false);
		});
	});
});
