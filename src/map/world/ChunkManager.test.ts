import { NullEngine, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';
import { World } from '@transcendence/game-shared';
import { describe, expect, test } from 'vitest';
import { ChunkManager } from './ChunkManager';

describe('ChunkManager', () => {
	test('publishes generated chunks outside the update call', async () => {
		const engine = new NullEngine();
		const scene = new Scene(engine);
		const times = [0, 0, 4];
		const chunks = new ChunkManager(
			scene,
			new World(12345),
			new StandardMaterial('terrain', scene),
			1,
			() => times.shift() ?? 4,
		);

		chunks.update(Vector3.Zero());
		await Promise.resolve();
		await new Promise<void>((resolve) => setTimeout(resolve, 0));

		expect(scene.meshes).toHaveLength(1);
		chunks.dispose();
		engine.dispose();
	});
});
