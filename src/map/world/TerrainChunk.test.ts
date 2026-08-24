import {
	NullEngine,
	Scene,
	StandardMaterial,
	VertexBuffer,
} from '@babylonjs/core';
import { World } from '@transcendence/game-shared';
import { describe, expect, test } from 'vitest';
import { buildChunkMesh } from './TerrainChunk';

describe('buildChunkMesh', () => {
	test('builds a shared smooth grid with continuous world UVs', () => {
		const engine = new NullEngine();
		const scene = new Scene(engine);
		const world = new World(12345);
		const mesh = buildChunkMesh(
			scene,
			world,
			2,
			-1,
			new StandardMaterial('terrain', scene),
		);
		const indices = mesh.getIndices()!;
		const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
		const normals = mesh.getVerticesData(VertexBuffer.NormalKind)!;
		const uvs = mesh.getVerticesData(VertexBuffer.UVKind)!;
		const segments = world.N * 4;
		expect(mesh.getTotalVertices()).toBe((segments + 1) ** 2);
		expect(indices.length).toBe(segments * segments * 6);
		expect(new Set(indices).size).toBe(mesh.getTotalVertices());
		expect(mesh.isVerticesDataPresent(VertexBuffer.NormalKind)).toBe(true);
		expect(mesh.isVerticesDataPresent(VertexBuffer.UVKind)).toBe(true);
		expect(positions[1]).toBeCloseTo(world.height(96, -48));
		expect(uvs[0]).toBeCloseTo((96 + 512) / 1024);
		expect(uvs[1]).toBeCloseTo((-48 + 512) / 1024);
		const heights = [];
		for (let index = 1; index < positions.length; index += 3)
			heights.push(positions[index]);
		expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.1);
		for (let index = 0; index < normals.length; index += 3)
			expect(
				Math.hypot(normals[index], normals[index + 1], normals[index + 2]),
			).toBeCloseTo(1, 5);
		engine.dispose();
	});
});
