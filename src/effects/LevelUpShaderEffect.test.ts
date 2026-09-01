import { describe, expect, it } from 'vitest';
import { levelUpPulseProgress } from './LevelUpShaderEffect';

describe('levelUpPulseProgress', () => {
	it('keeps the shader pulse normalized and deterministic', () => {
		expect(levelUpPulseProgress(-1)).toBe(0);
		expect(levelUpPulseProgress(0)).toBe(0);
		expect(levelUpPulseProgress(0.6)).toBeCloseTo(0.5);
		expect(levelUpPulseProgress(1.2)).toBe(1);
		expect(levelUpPulseProgress(4)).toBe(1);
		expect(levelUpPulseProgress(Number.NaN)).toBe(1);
	});
});
