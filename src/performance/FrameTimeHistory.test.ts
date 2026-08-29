import { describe, expect, test } from 'vitest';
import { FrameTimeHistory } from './FrameTimeHistory';

describe('FrameTimeHistory', () => {
	test('averages samples from the current sliding window', () => {
		const history = new FrameTimeHistory(60_000);

		history.add(10, 0);
		history.add(20, 30_000);
		history.add(30, 60_001);

		expect(history.average(60_001)).toBe(25);
		expect(history.average(90_001)).toBe(30);
	});

	test('ignores invalid samples', () => {
		const history = new FrameTimeHistory(60_000);

		history.add(Number.NaN, 0);
		history.add(10, Number.POSITIVE_INFINITY);

		expect(history.average(1_000)).toBeNull();
	});

	test('keeps the sliding average when the circular buffer wraps', () => {
		const history = new FrameTimeHistory(100);

		for (let index = 0; index <= 32; index++)
			history.add(index, index * 10);

		expect(history.average(320)).toBe(27);
	});
});
