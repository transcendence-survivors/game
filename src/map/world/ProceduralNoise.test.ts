import { describe, expect, test } from 'vitest';
import { fbm2d, hash2, smoothstep, valueNoise2d } from './ProceduralNoise';

describe('ProceduralNoise golden values', () => {
	test('keeps the shared scalar and hash formulas stable', () => {
		expect(smoothstep(0, 1, -1)).toBe(0);
		expect(smoothstep(0, 1, 0.25)).toBe(0.15625);
		expect(smoothstep(0, 1, 2)).toBe(1);
		expect(hash2(12, -10, 123456789)).toBe(0.7745107309892774);
	});

	test.each([
		[0, 0, 0, -1, -0.5627768177228669],
		[12.25, -9.75, 123456789, 0.3751198512568408, 0.25577988869554247],
		[-0.125, 0.875, 0x7fffffff, 0.1888648007720377, 0.15063390257877624],
	])(
		'keeps value noise and fbm stable at (%s, %s) for seed %s',
		(x, z, seed, noise, fbm) => {
			expect(valueNoise2d(x, z, seed)).toBe(noise);
			expect(fbm2d(x, z, seed)).toBe(fbm);
		},
	);
});
