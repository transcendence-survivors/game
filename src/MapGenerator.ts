import type { Scene } from '@babylonjs/core';
import * as BABYLON from '@babylonjs/core';
import { World, ChunkManager } from './world';
import { SunRayVolumetric } from './effects/SunRayVolumetric';

const SUN_H = 150;
const ACCESS_RADIUS = 128;
const RAY_SPEED = 1;
const RAY_DIR_X = 0;
const RAY_DIR_Z = 1;

export class MapGenerator {
	private scene: Scene;
	private world!: World;
	private terrainMaterial!: BABYLON.StandardMaterial;
	private chunkManager!: ChunkManager;
	private sunRay!: SunRayVolumetric;
	private rayLight!: BABYLON.SpotLight;
	private rayCenter!: BABYLON.Vector3;
	private shadowGen!: BABYLON.ShadowGenerator;

	constructor(scene: Scene) {
		this.scene = scene;
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

		this.world = new World(Math.floor(Math.random() * 1e9));

		const beamColor = new BABYLON.Color3(1.0, 0.9, 0.62);
		const strikeY = this.world.height(0, 0);
		this.rayCenter = new BABYLON.Vector3(0, strikeY, 0);

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

	update(dt: number, player: BABYLON.AbstractMesh) {
		this.rayCenter.x += RAY_DIR_X * RAY_SPEED * dt;
		this.rayCenter.z += RAY_DIR_Z * RAY_SPEED * dt;
		this.rayCenter.y = this.world.height(
			this.rayCenter.x,
			this.rayCenter.z,
		);
		const dx = player.position.x - this.rayCenter.x;
		const dz = player.position.z - this.rayCenter.z;
		const dist = Math.hypot(dx, dz);
		if (dist > ACCESS_RADIUS) {
			const k = ACCESS_RADIUS / dist;
			player.position.x = this.rayCenter.x + dx * k;
			player.position.z = this.rayCenter.z + dz * k;
		}
		const groundY = this.world.height(player.position.x, player.position.z);
		player.position.y +=
			(groundY - player.position.y) * Math.min(1, dt * 14);

		this.chunkManager.update(this.rayCenter);
		this.updateRay();
	}

	getGroundHeight(x: number, z: number): number {
		return this.world.height(x, z);
	}

	addShadowCaster(mesh: BABYLON.AbstractMesh) {
		this.shadowGen.addShadowCaster(mesh);
	}

	private updateRay() {
		const r = this.rayCenter;
		this.sunRay.setStrike(r.x, r.y, r.z);
		const d = this.rayLight.direction;
		this.rayLight.position.set(
			r.x - d.x * SUN_H,
			r.y - d.y * SUN_H,
			r.z - d.z * SUN_H,
		);
	}

	dispose() {
		this.shadowGen.dispose();
		this.rayLight.dispose();
		this.terrainMaterial.dispose();
	}
}
