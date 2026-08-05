import type { Scene } from '@babylonjs/core';
import * as BABYLON from '@babylonjs/core';
import { World, ChunkManager } from './world';
import { SunRayVolumetric } from './effects/SunRayVolumetric';
import {
	PlayerAuraPlugin,
	type AuraInstance,
} from './effects/PlayerAuraPlugin';
import { ACCESS_RADIUS } from '../../../shared-package/src';

export class MapGenerator {
	readonly ZONE_RADIUS = ACCESS_RADIUS;
	private readonly BEAM_LIGHT_H = 95;

	private scene: Scene;
	private world!: World;
	private terrainMaterial!: BABYLON.StandardMaterial;
	private auraPlugin!: PlayerAuraPlugin;
	private chunkManager!: ChunkManager;
	private sunRay!: SunRayVolumetric;
	private rayLight!: BABYLON.PointLight;
	private shadowGen!: BABYLON.ShadowGenerator;
	private rayPos!: BABYLON.Vector3;
	private zoneBoundary!: BABYLON.Mesh;

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
		this.auraPlugin = new PlayerAuraPlugin(this.terrainMaterial);

		const beamColor = new BABYLON.Color3(1.0, 0.9, 0.62);
		const strikeY = this.world.height(0, 0);
		this.rayPos = new BABYLON.Vector3(0, strikeY, 0);

		this.rayLight = new BABYLON.PointLight(
			'SunRayLight',
			new BABYLON.Vector3(0, strikeY + this.BEAM_LIGHT_H, 0),
			this.scene,
		);
		this.rayLight.diffuse = beamColor;
		this.rayLight.specular = new BABYLON.Color3(0.2, 0.18, 0.12);
		this.rayLight.intensity = 13;
		this.rayLight.range = this.BEAM_LIGHT_H + this.ZONE_RADIUS - 40;
		this.rayLight.falloffType = BABYLON.Light.FALLOFF_STANDARD;
		this.shadowGen = new BABYLON.ShadowGenerator(2048, this.rayLight);
		this.shadowGen.usePercentageCloserFiltering = true;
		this.shadowGen.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
		this.shadowGen.bias = 0.0016;
		this.shadowGen.normalBias = 0.7;
		this.shadowGen.setDarkness(0.12);
		const shadowMap = this.shadowGen.getShadowMap();
		if (shadowMap) shadowMap.refreshRate = 2;

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

		if (this.scene.activeCamera) {
			new BABYLON.FxaaPostProcess('fxaa', 1.0, this.scene.activeCamera);
		}

		this.createZoneBoundary(strikeY);

		this.scene.blockMaterialDirtyMechanism = true;
	}

	private createZoneBoundary(baseY: number) {
		const wall = BABYLON.MeshBuilder.CreateCylinder(
			'zoneBoundary',
			{
				diameter: this.ZONE_RADIUS * 2,
				height: 140,
				tessellation: 96,
				cap: BABYLON.Mesh.NO_CAP,
			},
			this.scene,
		);

		const grad = new BABYLON.DynamicTexture(
			'zoneBoundaryGrad',
			{ width: 4, height: 128 },
			this.scene,
			false,
		);
		const ctx = grad.getContext() as unknown as CanvasRenderingContext2D;
		const g = ctx.createLinearGradient(0, 128, 0, 0);
		g.addColorStop(0, 'rgba(255,255,255,0.85)');
		g.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 4, 128);
		grad.update();
		grad.hasAlpha = true;

		const mat = new BABYLON.StandardMaterial('zoneBoundaryMat', this.scene);
		mat.disableLighting = true;
		mat.emissiveColor = new BABYLON.Color3(1.0, 0.55, 0.25);
		mat.diffuseColor = new BABYLON.Color3(0, 0, 0);
		mat.opacityTexture = grad;
		mat.backFaceCulling = false;
		mat.alphaMode = BABYLON.Constants.ALPHA_ADD;
		wall.material = mat;

		wall.isPickable = false;
		wall.receiveShadows = false;
		wall.doNotSyncBoundingInfo = true;
		wall.alwaysSelectAsActiveMesh = true;
		wall.position.set(0, baseY, 0);
		this.zoneBoundary = wall;
	}

	syncFromRoom(rayX: number, rayY: number, rayZ: number) {
		this.rayPos.set(rayX, rayY, rayZ);
		this.sunRay.setStrike(rayX, rayY, rayZ);
		this.rayLight.position.set(rayX, rayY + this.BEAM_LIGHT_H, rayZ);
		this.zoneBoundary.position.set(rayX, rayY, rayZ);
		this.chunkManager.update(this.rayPos);
	}

	clampToZone(x: number, z: number): { x: number; z: number } {
		const ox = x - this.rayPos.x;
		const oz = z - this.rayPos.z;
		const distSq = ox * ox + oz * oz;
		if (distSq <= this.ZONE_RADIUS * this.ZONE_RADIUS) return { x, z };
		const dist = Math.sqrt(distSq);
		const scale = this.ZONE_RADIUS / dist;
		return { x: this.rayPos.x + ox * scale, z: this.rayPos.z + oz * scale };
	}

	updateAuras(auras: readonly AuraInstance[], dtSeconds: number) {
		this.auraPlugin.update(auras, dtSeconds);
	}

	getGroundHeight(x: number, z: number): number {
		return this.world.height(x, z);
	}

	getWorld() {
		return this.world;
	}

	addShadowCaster(mesh: BABYLON.AbstractMesh) {
		this.shadowGen.addShadowCaster(mesh);
	}

	dispose() {
		this.shadowGen.dispose();
		this.rayLight.dispose();
		this.terrainMaterial.dispose();
		this.zoneBoundary.material?.dispose();
		this.zoneBoundary.dispose();
	}
}
