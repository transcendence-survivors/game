import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { GLTFFileLoader } from '@babylonjs/loaders/glTF/glTFFileLoader.js';
import '@babylonjs/loaders/glTF/2.0/glTFLoader.js';
import { Monster } from '@transcendence/game-shared';
import { BakedMonsterRenderer } from './BakedMonsterRenderer';

describe('BakedMonsterRenderer', () => {
	test('bakes and renders a real monster GLB as a thin instance', async () => {
		const engine = new BABYLON.NullEngine();
		const scene = new BABYLON.Scene(engine);
		const camera = new BABYLON.FreeCamera(
			'camera',
			new BABYLON.Vector3(0, 10, -20),
			scene,
		);
		camera.setTarget(BABYLON.Vector3.Zero());
		scene.activeCamera = camera;
		new BABYLON.HemisphericLight('light', BABYLON.Vector3.Up(), scene);

		const assetUrl = new URL(
			'../assets/models/monster/ultimate/dog.glb',
			import.meta.url,
		);
		const loader = new GLTFFileLoader();
		const loaderData = await new Promise<unknown>((resolve, reject) => {
			loader.loadFile(
				scene,
				new Uint8Array(readFileSync(assetUrl)),
				'',
				resolve,
				undefined,
				true,
				(_request, error) => reject(error),
				'dog.glb',
			);
		});
		const container = await loader.loadAssetContainerAsync(
			scene,
			loaderData as never,
			'',
			undefined,
			'dog.glb',
		);
		const assets = {
			instantiate: async (_url: string, name: string) => {
				const instance = container.instantiateModelsToScene(
					(nodeName) => `${name}:${nodeName}`,
					false,
					{ doNotInstantiate: true },
				);
				return {
					root: instance.rootNodes[0] as BABYLON.AbstractMesh,
					animationGroups: instance.animationGroups,
				};
			},
		};
		const map = {
			getGroundHeight: () => 0,
			prepareRenderable: () => {},
		};
		const renderer = new BakedMonsterRenderer(
			scene,
			map as never,
			assets as never,
			async () => {},
		);
		const monster = new Monster();
		monster.kind = 'grunt';
		monster.animState = 'walk';
		await renderer.add(monster, 'one');
		const count = renderer.update(
			1 / 60,
			1 / 60,
			{
				cameraX: 0,
				cameraZ: -20,
				forwardX: 0,
				forwardZ: 1,
				halfFovTangent: 1,
			},
			false,
		);
		scene.render();

		expect(count).toBe(1);
		expect(
			scene.meshes.some(
				(mesh) =>
					mesh instanceof BABYLON.Mesh &&
					mesh.thinInstanceCount === 1 &&
					mesh.bakedVertexAnimationManager !== null,
			),
		).toBe(true);
		const renderedMesh = scene.meshes.find(
			(mesh): mesh is BABYLON.Mesh =>
				mesh instanceof BABYLON.Mesh && mesh.thinInstanceCount === 1,
		)!;
		monster.x = 3;
		renderer.setTarget('one', monster);
		renderer.update(
			0.1,
			0.1,
			{
				cameraX: 0,
				cameraZ: -20,
				forwardX: 0,
				forwardZ: 1,
				halfFovTangent: 1,
			},
			false,
		);
		const translatedX = renderedMesh
			.thinInstanceGetWorldMatrices()[0]
			.getTranslation().x;
		expect(translatedX).toBeCloseTo(3);

		renderer.dispose();
		container.dispose();
		scene.dispose();
		engine.dispose();
	});
});
