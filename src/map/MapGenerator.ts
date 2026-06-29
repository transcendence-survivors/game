import type { Scene } from '@babylonjs/core';
import * as BABYLON from '@babylonjs/core';
import { World, ChunkManager } from './world';
import { SunRayVolumetric } from './effects/SunRayVolumetric';
import { SUN_H } from '../../../shared-package/src';

export class MapGenerator {
	private scene: Scene;
	private world!: World;
	private terrainMaterial!: BABYLON.StandardMaterial;
	private chunkManager!: ChunkManager;
	private sunRay!: SunRayVolumetric;
	private rayLight!: BABYLON.SpotLight;
	private shadowGen!: BABYLON.ShadowGenerator;

	constructor(scene: Scene, seed: number) {
		this.scene = scene;
		this.world = new World(seed);
		this.init();
	}

	private init() {
		this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);
		this.scene.ambientColor = new BABYLON.Color3(0, 0, 0);
		this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
		this.scene.fogColor = new BABYLON.Color3(0, 0, 0);
		this.scene.fogDensity = 0.004;

		this.terrainMaterial = new BABYLON.StandardMaterial(
			'terrain',
			this.scene,
		);
		this.terrainMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
		this.terrainMaterial.specularColor = new BABYLON.Color3(0, 0, 0);

		const beamColor = new BABYLON.Color3(1.0, 0.9, 0.62);
		const strikeY = this.world.height(0, 0);

		const sunDir = new BABYLON.Vector3(0.4, -0.82, 0.3);
		this.rayLight = new BABYLON.SpotLight(
			'SunRayLight',
			new BABYLON.Vector3(
				-sunDir.x * SUN_H,
				strikeY - sunDir.y * SUN_H,
				-sunDir.z * SUN_H,
			),
			sunDir,
			2.0,
			7,
			this.scene,
		);
		this.rayLight.diffuse = beamColor;
		this.rayLight.specular = new BABYLON.Color3(0.2, 0.18, 0.12);
		this.rayLight.intensity = 70;
		this.rayLight.range = 360;
		this.rayLight.shadowMinZ = 40;
		this.rayLight.shadowMaxZ = 300;

		this.shadowGen = new BABYLON.ShadowGenerator(4096, this.rayLight);
		this.shadowGen.usePercentageCloserFiltering = true;
		this.shadowGen.bias = 0.0015;
		this.shadowGen.normalBias = 0.2;
		this.shadowGen.setDarkness(0.0);

		this.chunkManager = new ChunkManager(
			this.scene,
			this.world,
			this.terrainMaterial,
			{
				viewDistance: 4,
				flat: true,
				onChunk: (mesh) => {
					mesh.receiveShadows = true;
					this.shadowGen.addShadowCaster(mesh);
				},
			},
		);
		this.chunkManager.update(BABYLON.Vector3.Zero());

		this.sunRay = new SunRayVolumetric(this.scene, {
			color: beamColor,
			strikeY,
			radius: 8,
			height: 140,
			intensity: 1.0,
		});
	}

	syncFromRoom(rayX: number, rayY: number, rayZ: number) {
		this.sunRay.setStrike(rayX, rayY, rayZ);
		const d = this.rayLight.direction;
		this.rayLight.position.set(
			rayX - d.x * SUN_H,
			rayY - d.y * SUN_H,
			rayZ - d.z * SUN_H,
		);
		this.chunkManager.update(new BABYLON.Vector3(rayX, rayY, rayZ));
	}

	getGroundHeight(x: number, z: number): number {
		return this.world.height(x, z);
	}

	addShadowCaster(mesh: BABYLON.AbstractMesh) {
		this.shadowGen.addShadowCaster(mesh);
	}

	dispose() {
		this.shadowGen.dispose();
		this.rayLight.dispose();
		this.terrainMaterial.dispose();
	}
}
