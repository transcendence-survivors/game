import { World } from '@transcendence/game-shared';
import { describe, expect, test } from 'vitest';
import {
	FOREST_PLACEMENT_KINDS,
	generateForestPlacementsInto,
} from './ForestPlacement';
import {
	FOREST_PLACEMENT_CAPACITY,
	FOREST_PLACEMENT_STRIDE,
} from '../world/WorldGenerationProtocol';

interface TestPlacement {
	kind: (typeof FOREST_PLACEMENT_KINDS)[number];
	x: number;
	z: number;
	scale: number;
}

function generatePlacements(
	world: World,
	chunkX: number,
	chunkZ: number,
): TestPlacement[] {
	const output = new Float64Array(
		FOREST_PLACEMENT_CAPACITY * FOREST_PLACEMENT_STRIDE,
	);
	const count = generateForestPlacementsInto(world, chunkX, chunkZ, output);
	return Array.from({ length: count }, (_, index) => {
		const offset = index * FOREST_PLACEMENT_STRIDE;
		return {
			kind: FOREST_PLACEMENT_KINDS[Math.trunc(output[offset]!)]!,
			x: output[offset + 2]!,
			z: output[offset + 3]!,
			scale: output[offset + 9]!,
		};
	});
}

describe('generateForestPlacementsInto', () => {
	test('is deterministic for a seed and chunk coordinate', () => {
		const world = new World(12345);

		expect(generatePlacements(world, -2, 4)).toEqual(
			generatePlacements(world, -2, 4),
		);
	});

	test('keeps placements inside their chunk and away from the start', () => {
		const world = new World(12345);
		const chunkX = 3;
		const chunkZ = -2;
		const chunkSize = world.N * world.CELL;
		const placements = generatePlacements(world, chunkX, chunkZ);

		expect(placements.length).toBeGreaterThan(0);
		for (const placement of placements) {
			expect(placement.x).toBeGreaterThan(chunkX * chunkSize);
			expect(placement.x).toBeLessThan((chunkX + 1) * chunkSize);
			expect(placement.z).toBeGreaterThan(chunkZ * chunkSize);
			expect(placement.z).toBeLessThan((chunkZ + 1) * chunkSize);
			expect(Math.hypot(placement.x, placement.z)).toBeGreaterThanOrEqual(
				20,
			);
		}
	});

	test('creates every requested environment category over nearby chunks', () => {
		const world = new World(987654321);
		const kinds = new Set(
			[-1, 0, 1].flatMap((chunkX) =>
				[-1, 0, 1].flatMap((chunkZ) =>
					generatePlacements(world, chunkX, chunkZ).map(
						(placement) => placement.kind,
					),
				),
			),
		);

		expect(kinds).toEqual(
			new Set(['tree', 'rock', 'bush', 'grass', 'flower']),
		);
	});

	test('fills each chunk with layered coverage instead of sparse props', () => {
		const world = new World(987654321);
		const placements = generatePlacements(world, 1, 0);
		const counts = new Map<string, number>();
		for (const placement of placements)
			counts.set(placement.kind, (counts.get(placement.kind) ?? 0) + 1);

		expect(placements.length).toBeGreaterThanOrEqual(70);
		expect(placements.length).toBeLessThanOrEqual(80);
		expect(counts.get('tree')).toBeGreaterThanOrEqual(2);
		expect(counts.get('bush')).toBeGreaterThanOrEqual(4);
		expect(counts.get('grass')).toBeGreaterThanOrEqual(30);
		expect(counts.get('flower')).toBeGreaterThanOrEqual(15);
	});

	test('keeps procedural macro scales inside the requested ranges', () => {
		const world = new World(987654321);
		const placements = generatePlacements(world, 0, 0);
		const trees = placements.filter((placement) => placement.kind === 'tree');
		const rocks = placements.filter((placement) => placement.kind === 'rock');

		expect(trees.length).toBeGreaterThan(0);
		expect(rocks.length).toBeGreaterThan(0);
		expect(trees.every(({ scale }) => scale >= 1 && scale <= 2)).toBe(true);
		expect(rocks.every(({ scale }) => scale >= 1 && scale <= 3)).toBe(true);
	});
});
