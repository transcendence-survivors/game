import { describe, expect, test } from 'vitest';
import {
	combatInterpolationFactor,
	shouldSnapCombatEntity,
} from './CombatEntityView';

describe('combat entity interpolation', () => {
	test('smooths normal jitter and caps long delayed frames', () => {
		expect(combatInterpolationFactor(1 / 60)).toBeCloseTo(1 / 3);
		expect(combatInterpolationFactor(0.5)).toBe(1);
		expect(combatInterpolationFactor(Number.NaN)).toBe(0);
	});

	test('snaps only after a large reconciliation distance', () => {
		expect(shouldSnapCombatEntity(36)).toBe(false);
		expect(shouldSnapCombatEntity(36.01)).toBe(true);
	});
});
