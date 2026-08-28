import { describe, expect, it } from 'vitest';
import {
	formatGameTime,
	hudBarWidth,
	isLivingBoss,
	normalizedLifeRatio,
} from './HudFormatting';

describe('isLivingBoss', () => {
	it('accepts method-free health data decoded from Colyseus', () => {
		expect(
			isLivingBoss({
				isBoss: true,
				life: { current: 100 },
			}),
		).toBe(true);
	});

	it('rejects depleted bosses and living normal monsters', () => {
		expect(isLivingBoss({ isBoss: true, life: { current: 0 } })).toBe(
			false,
		);
		expect(isLivingBoss({ isBoss: false, life: { current: 100 } })).toBe(
			false,
		);
	});
});

describe('normalizedLifeRatio', () => {
	it('clamps synchronized teammate health to a safe HUD ratio', () => {
		expect(normalizedLifeRatio(75, 100)).toBe(0.75);
		expect(normalizedLifeRatio(120, 100)).toBe(1);
		expect(normalizedLifeRatio(-5, 100)).toBe(0);
		expect(normalizedLifeRatio(Number.NaN, 100)).toBe(0);
		expect(normalizedLifeRatio(10, 0)).toBe(0);
	});
});

describe('HUD formatting', () => {
	it('formats timers and clamped bar widths', () => {
		expect(formatGameTime(125)).toBe('02:05');
		expect(formatGameTime(3_661)).toBe('01:01:01');
		expect(formatGameTime(Number.NaN)).toBe('00:00');
		expect(hudBarWidth(50, 100)).toBe('49.00%');
		expect(hudBarWidth(200, 100, 96)).toBe('96.00%');
	});
});
