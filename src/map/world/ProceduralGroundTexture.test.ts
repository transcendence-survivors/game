import { describe, expect, it } from 'vitest';
import { createProceduralGroundTextureData } from './ProceduralGroundTexture';

describe('createProceduralGroundTextureData', () => {
	it('keeps deterministic ground pixels', () => {
		const bytes = createProceduralGroundTextureData(123_456_789);
		const sampleIndices = [0, 1, 257, 65_535, 131_071, 262_143];
		const samples = sampleIndices.map((pixel) =>
			Array.from(bytes.slice(pixel * 4, pixel * 4 + 4)),
		);
		let hash = 2_166_136_261;
		for (const value of bytes) {
			hash ^= value;
			hash = Math.imul(hash, 16_777_619);
		}
		expect(samples).toEqual([
			[94, 187, 68, 255],
			[91, 181, 65, 255],
			[71, 159, 56, 255],
			[58, 120, 50, 255],
			[50, 113, 44, 255],
			[44, 124, 43, 255],
		]);
		expect(hash >>> 0).toBe(3_198_390_979);
		expect(bytes).toHaveLength(512 * 512 * 4);
	});
});
