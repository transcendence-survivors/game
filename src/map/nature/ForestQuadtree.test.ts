import { describe, expect, test } from 'vitest';
import {
	ForestQuadtree,
	type ForestBounds,
	type ForestFrustumPlane,
} from './ForestQuadtree';

const bounds = (
	minX: number,
	maxX: number,
	minZ: number,
	maxZ: number,
): ForestBounds => ({
	minX,
	maxX,
	minY: -10,
	maxY: 10,
	minZ,
	maxZ,
});

const plane = (
	x: number,
	y: number,
	z: number,
	d: number,
): ForestFrustumPlane => ({ normal: { x, y, z }, d });

const displayCircle = (centerX: number, centerZ: number, radius: number) => ({
	centerX,
	centerZ,
	radius,
});

describe('ForestQuadtree', () => {
	test('returns only bounds intersecting the frustum', () => {
		const tree = new ForestQuadtree<string>(32, 1);
		tree.insert('inside', bounds(-1, 1, -1, 1), 'inside');
		tree.insert('outside-x', bounds(10, 12, -1, 1), 'outside-x');
		tree.insert('outside-z', bounds(-1, 1, 10, 12), 'outside-z');

		const visible = new Set<string>();
		tree.query(
			[
				plane(1, 0, 0, 5),
				plane(-1, 0, 0, 5),
				plane(0, 0, 1, 5),
				plane(0, 0, -1, 5),
			],
			visible,
		);

		expect(visible).toEqual(new Set(['inside']));
	});

	test('expands for chunks outside the initial world area', () => {
		const tree = new ForestQuadtree<string>(8);
		tree.insert('far-negative', bounds(-100, -98, -100, -98), 'far-negative');

		const visible = new Set<string>();
		tree.query([], visible);

		expect(visible).toEqual(new Set(['far-negative']));
	});

	test('removes entries without returning stale pages', () => {
		const tree = new ForestQuadtree<string>(8, 1);
		tree.insert('keep', bounds(-1, 1, -1, 1), 'keep');
		tree.insert('remove', bounds(10, 12, 10, 12), 'remove');

		const visible = new Set<string>();
		tree.remove('remove');
		tree.query([], visible);

		expect(visible).toEqual(new Set(['keep']));
	});

	test('returns bounds that partially intersect the display circle', () => {
		const tree = new ForestQuadtree<string>(32);
		tree.insert('touching', bounds(4, 6, -1, 1), 'touching');
		tree.insert('outside', bounds(7, 9, -1, 1), 'outside');

		const visible = new Set<string>();
		tree.query([], visible, displayCircle(0, 0, 5));

		expect(visible).toEqual(new Set(['touching']));
	});
});
