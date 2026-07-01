import type { Scene } from '@babylonjs/core';
import * as BABYLON from '@babylonjs/core';
import { World, ChunkManager } from './world';
import { SunRayVolumetric } from './effects/SunRayVolumetric';
import { SUN_H, ACCESS_RADIUS } from '../../../shared-package/src';

export class MapGenerator {
	/** Rayon (unités monde) de la zone éclairée jouable — même valeur autoritative
	 * que le serveur (shared) pour que la prédiction client colle au clamp serveur. */
	readonly ZONE_RADIUS = ACCESS_RADIUS;

	private scene: Scene;
	private world!: World;
	private terrainMaterial!: BABYLON.StandardMaterial;
	private chunkManager!: ChunkManager;
	private sunRay!: SunRayVolumetric;
	private rayLight!: BABYLON.SpotLight;
	private shadowGen!: BABYLON.ShadowGenerator;
	private rayPos!: BABYLON.Vector3;

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
		// Jamais modifié après coup et partagé par toutes les chunks de terrain
		// (jusqu'à ~80 en vue) : geler évite de revalider ses defines/bindings
		// à chaque mesh à chaque frame.
		this.terrainMaterial.freeze();

		const beamColor = new BABYLON.Color3(1.0, 0.9, 0.62);
		const strikeY = this.world.height(0, 0);
		this.rayPos = new BABYLON.Vector3(0, strikeY, 0);

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

		// 1024 + PCF qualité basse : le rendu est en flat shading low-poly, une
		// shadow map 4K ne s'y voit pas mais coûtait ~16x plus cher à rasteriser.
		this.shadowGen = new BABYLON.ShadowGenerator(1024, this.rayLight);
		this.shadowGen.usePercentageCloserFiltering = true;
		this.shadowGen.filteringQuality = BABYLON.ShadowGenerator.QUALITY_LOW;
		this.shadowGen.bias = 0.0015;
		this.shadowGen.normalBias = 0.2;
		this.shadowGen.setDarkness(0.0);
		// Le terrain est figé (freezeWorldMatrix) et le point d'impact du rayon
		// bouge rarement : pas besoin de re-rasteriser la shadow map 60x/s.
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

		// Lumières et matériaux de la scène sont figés une fois pour toutes ici :
		// plus besoin du scan qui remarque tous les matériaux "dirty" au moindre
		// changement de lumière/scène.
		this.scene.blockMaterialDirtyMechanism = true;
	}

	/**
	 * Recale le rayon sur la position autoritative reçue du serveur : déplace le
	 * halo volumétrique et la lumière, mémorise le centre pour le clamp de zone,
	 * et déclenche le streaming des chunks autour du rayon (le joueur reste borné
	 * dans ce disque, donc toujours dans la zone chargée).
	 */
	syncFromRoom(rayX: number, rayY: number, rayZ: number) {
		this.rayPos.set(rayX, rayY, rayZ);
		this.sunRay.setStrike(rayX, rayY, rayZ);
		const d = this.rayLight.direction;
		this.rayLight.position.set(
			rayX - d.x * SUN_H,
			rayY - d.y * SUN_H,
			rayZ - d.z * SUN_H,
		);
		this.chunkManager.update(this.rayPos);
	}

	/**
	 * Projette (x, z) sur le bord du disque `ZONE_RADIUS` autour du rayon si le
	 * point en est sorti — prédiction locale du clamp que le serveur applique de
	 * façon autoritative. Repousse le joueur y compris quand c'est le rayon qui
	 * avance vers lui.
	 */
	clampToZone(x: number, z: number): { x: number; z: number } {
		const ox = x - this.rayPos.x;
		const oz = z - this.rayPos.z;
		const distSq = ox * ox + oz * oz;
		if (distSq <= this.ZONE_RADIUS * this.ZONE_RADIUS) return { x, z };
		const dist = Math.sqrt(distSq);
		const scale = this.ZONE_RADIUS / dist;
		return { x: this.rayPos.x + ox * scale, z: this.rayPos.z + oz * scale };
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
