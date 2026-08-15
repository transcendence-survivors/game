import { describe, expect, test } from 'vitest';
import { radialVisibility } from './RadialLightingPostProcess';

describe('radialVisibility', () => {
	test('depends on world distance and preserves the configured penumbra', () => {
		expect(radialVisibility(0, 10, 20, 0.2)).toBe(1);
		expect(radialVisibility(10, 10, 20, 0.2)).toBe(1);
		expect(radialVisibility(15, 10, 20, 0.2)).toBeCloseTo(0.6);
		expect(radialVisibility(20, 10, 20, 0.2)).toBeCloseTo(0.2);
		expect(radialVisibility(100, 10, 20, 0.2)).toBeCloseTo(0.2);
	});

	test('rejects non-finite inputs deterministically', () => {
		expect(radialVisibility(Number.NaN, 10, 20, 0.2)).toBe(0);
	});
});
