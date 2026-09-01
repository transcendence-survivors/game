import * as BABYLON from '@babylonjs/core';
import type { MapGenerator } from '../MapGenerator';
import type { ModelAssetLibrary } from '../../assets/ModelAssetLibrary';
import type { WorldGenerationClient } from '../world/WorldGenerationClient';
import {
	FOREST_BIOMES,
	FOREST_PLACEMENT_KINDS,
	type ForestPlacement,
	type ForestPlacementBuffer,
} from './ForestPlacement';
import { ForestRenderer } from './ForestRenderer';
import { World } from '@transcendence/game-shared';
import { describe, expect, test } from 'vitest';

const unusedGeneration = {} as WorldGenerationClient;

function createTestMap(
	world: World,
	ground: (x: number, z: number) => number,
): MapGenerator {
	return {
		getWorld: () => world,
		getGenerationClient: () => unusedGeneration,
		getGroundHeight: ground,
		prepareRenderable: () => {},
	} as unknown as MapGenerator;
}

interface RendererInternals {
	attachModel(
		chunk: { root: BABYLON.TransformNode },
		model: BABYLON.AbstractMesh,
		placement: ForestPlacement,
		url: string,
	): void;
	attachPackedThinInstanceBatch(
		chunk: { x: number; z: number; root: BABYLON.TransformNode },
		model: BABYLON.AbstractMesh,
		placements: ForestPlacementBuffer,
		placementIndices: readonly number[],
		url: string,
	): boolean;
}

function createPlacement(normal: BABYLON.Vector3): ForestPlacement {
	return {
		kind: 'tree',
		biome: 'forest',
		x: 0,
		z: 0,
		y: 0,
		normalX: normal.x,
		normalY: normal.y,
		normalZ: normal.z,
		rotationY: 0.35,
		scale: 1,
		variant: 0,
	};
}

function packForestPlacements(
	placements: readonly ForestPlacement[],
): Float64Array {
	return Float64Array.from(
		placements.flatMap((placement) => [
			FOREST_PLACEMENT_KINDS.indexOf(placement.kind),
			FOREST_BIOMES.indexOf(placement.biome),
			placement.x,
			placement.z,
			placement.y,
			placement.normalX,
			placement.normalY,
			placement.normalZ,
			placement.rotationY,
			placement.scale,
			placement.variant,
		]),
	);
}

function createTestTree(scene: BABYLON.Scene): BABYLON.Mesh {
	const positions = [
		-0.8, 0, -0.8, 0.8, 0, -0.8, 0.8, 0, 0.8, -0.8, 0, 0.8, 0, 4, 0,
	];
	const indices = [0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4, 0, 3, 2, 0, 2, 1];
	const normals = new Array<number>(positions.length).fill(0);
	BABYLON.VertexData.ComputeNormals(positions, indices, normals);
	const data = new BABYLON.VertexData();
	data.positions = positions;
	data.indices = indices;
	data.normals = normals;
	const mesh = new BABYLON.Mesh('testTree', scene);
	data.applyToMesh(mesh);
	return mesh;
}

function attachTestTree(
	ground: (x: number, z: number) => number,
	normal: BABYLON.Vector3,
): BABYLON.Mesh {
	const engine = new BABYLON.NullEngine();
	const scene = new BABYLON.Scene(engine);
	const world = new World(12345);
	const map = createTestMap(world, ground);
	const renderer = new ForestRenderer(
		scene,
		map,
		undefined as unknown as ModelAssetLibrary,
		1,
	);
	expect(scene.skipFrustumClipping).toBe(false);
	const chunkRoot = new BABYLON.TransformNode('testChunk', scene);
	const tree = createTestTree(scene);
	const internals = renderer as unknown as RendererInternals;
	internals.attachModel(
		{ root: chunkRoot },
		tree,
		createPlacement(normal),
		'test-tree.glb',
	);
	return tree;
}

function attachThinInstanceTestTree(
	ground: (x: number, z: number) => number,
	placements: readonly ForestPlacement[],
): BABYLON.Mesh {
	const engine = new BABYLON.NullEngine();
	const scene = new BABYLON.Scene(engine);
	const world = new World(12345);
	const map = createTestMap(world, ground);
	const renderer = new ForestRenderer(
		scene,
		map,
		undefined as unknown as ModelAssetLibrary,
		1,
	);
	expect(scene.skipFrustumClipping).toBe(false);
	const chunkRoot = new BABYLON.TransformNode('testChunk', scene);
	const tree = createTestTree(scene);
	const internals = renderer as unknown as RendererInternals;
	const packed: ForestPlacementBuffer = {
		data: packForestPlacements(placements),
		count: placements.length,
		release: () => {},
	};
	const attached = internals.attachPackedThinInstanceBatch(
		{ x: 0, z: 0, root: chunkRoot },
		tree,
		packed,
		placements.map((_, index) => index),
		'test-tree-batch.glb',
	);
	expect(attached).toBe(true);
	return tree;
}

describe('ForestRenderer terrain contact', () => {
	test('aligns the GLB up axis with a sloped ground normal', () => {
		const ground = (x: number, z: number) => 0.25 * x - 0.15 * z;
		const normal = new BABYLON.Vector3(-0.25, 1, 0.15).normalize();
		const tree = attachTestTree(ground, normal);
		const up = BABYLON.Vector3.TransformNormal(
			BABYLON.Axis.Y,
			tree.getWorldMatrix(),
		).normalize();

		expect(up.x).toBeCloseTo(normal.x, 3);
		expect(up.y).toBeCloseTo(normal.y, 3);
		expect(up.z).toBeCloseTo(normal.z, 3);
		tree.getScene().getEngine().dispose();
	});

	test('keeps every lower base vertex on a curved ground surface', () => {
		const ground = (x: number, z: number) =>
			0.25 * x - 0.15 * z + 0.05 * x * z;
		const normal = new BABYLON.Vector3(-0.25, 1, 0.15).normalize();
		const tree = attachTestTree(ground, normal);
		const positions = tree.getVerticesData(
			BABYLON.VertexBuffer.PositionKind,
		)!;
		const worldMatrix = tree.getWorldMatrix();
		for (let index = 0; index < 12; index += 3) {
			const point = BABYLON.Vector3.TransformCoordinates(
				new BABYLON.Vector3(
					positions[index],
					positions[index + 1],
					positions[index + 2],
				),
				worldMatrix,
			);
			expect(point.y).toBeCloseTo(ground(point.x, point.z) + 0.005, 3);
		}
		tree.getScene().getEngine().dispose();
	});

	test('uses one static thin-instance source for repeated decorations', () => {
		const ground = (x: number, z: number) => 0.25 * x - 0.15 * z;
		const normal = new BABYLON.Vector3(-0.25, 1, 0.15).normalize();
		const placements = [
			{ ...createPlacement(normal), y: ground(0, 0) },
			{
				...createPlacement(normal),
				x: 4,
				z: -2,
				y: ground(4, -2),
				scale: 1.4,
			},
		];
		const tree = attachThinInstanceTestTree(ground, placements);

		expect(tree.thinInstanceCount).toBe(2);
		expect(tree.alwaysSelectAsActiveMesh).toBe(true);
		expect(tree.isWorldMatrixFrozen).toBe(true);
		expect(tree.getScene().meshes).toHaveLength(1);
		const matrices = tree.thinInstanceGetWorldMatrices();
		expect(matrices).toHaveLength(2);
		for (const matrix of matrices) {
			const up = BABYLON.Vector3.TransformNormal(
				BABYLON.Axis.Y,
				matrix,
			).normalize();
			expect(up.x).toBeCloseTo(normal.x, 3);
			expect(up.y).toBeCloseTo(normal.y, 3);
			expect(up.z).toBeCloseTo(normal.z, 3);
		}
		tree.getScene().getEngine().dispose();
	});

	test('reuses one page source across chunks', () => {
		const engine = new BABYLON.NullEngine();
		const scene = new BABYLON.Scene(engine);
		const world = new World(12345);
		const map = createTestMap(
			world,
			(x: number, z: number) => 0.25 * x - 0.15 * z,
		);
		const renderer = new ForestRenderer(
			scene,
			map,
			undefined as unknown as ModelAssetLibrary,
			1,
		);
		const chunkA = new BABYLON.TransformNode('chunk-a', scene);
		const chunkB = new BABYLON.TransformNode('chunk-b', scene);
		const normal = new BABYLON.Vector3(-0.25, 1, 0.15).normalize();
		const first = createTestTree(scene);
		const second = createTestTree(scene);
		const internals = renderer as unknown as RendererInternals;

		expect(
			internals.attachPackedThinInstanceBatch(
				{ x: 0, z: 0, root: chunkA },
				first,
				{
					data: packForestPlacements([
						{ ...createPlacement(normal), y: 0 },
					]),
					count: 1,
					release: () => {},
				},
				[0],
				'global-tree.glb',
			),
		).toBe(true);
		expect(
			internals.attachPackedThinInstanceBatch(
				{ x: 1, z: 0, root: chunkB },
				second,
				{
					data: packForestPlacements([
						{ ...createPlacement(normal), x: 8, y: 2 },
					]),
					count: 1,
					release: () => {},
				},
				[0],
				'global-tree.glb',
			),
		).toBe(true);

		expect(scene.meshes).toHaveLength(1);
		expect(first.parent?.name).toBe('forestPage:0,0');
		expect(first.thinInstanceCount).toBe(2);
		expect(second.isDisposed()).toBe(true);

		renderer.dispose();
		engine.dispose();
	});

	test('keeps batched support points from floating above curved terrain', () => {
		const ground = (x: number, z: number) =>
			0.25 * x - 0.15 * z + 0.05 * x * z;
		const normal = new BABYLON.Vector3(-0.25, 1, 0.15).normalize();
		const placements = [
			{ ...createPlacement(normal), y: ground(0, 0) },
			{
				...createPlacement(normal),
				x: 3,
				z: 2,
				y: ground(3, 2),
			},
		];
		const tree = attachThinInstanceTestTree(ground, placements);
		const positions = tree.getVerticesData(
			BABYLON.VertexBuffer.PositionKind,
		)!;
		const matrices = tree.thinInstanceGetWorldMatrices();

		for (const matrix of matrices) {
			let touching = false;
			for (let index = 0; index < 12; index += 3) {
				const point = BABYLON.Vector3.TransformCoordinates(
					new BABYLON.Vector3(
						positions[index],
						positions[index + 1],
						positions[index + 2],
					),
					matrix,
				);
				const gap = point.y - ground(point.x, point.z) - 0.005;
				expect(gap).toBeLessThanOrEqual(0.0001);
				if (Math.abs(gap) <= 0.0001) touching = true;
			}
			expect(touching).toBe(true);
		}
		tree.getScene().getEngine().dispose();
	});
});
