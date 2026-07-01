import type { Scene } from '@babylonjs/core';
import * as BABYLON from '@babylonjs/core';
import { World, ChunkManager } from './world';
import { SunRayVolumetric } from './effects/SunRayVolumetric';
import { ACCESS_RADIUS } from '../../../shared-package/src';

export class MapGenerator {
	/** Rayon (unités monde) de la zone éclairée jouable — même valeur autoritative
	 * que le serveur (shared) pour que la prédiction client colle au clamp serveur. */
	readonly ZONE_RADIUS = ACCESS_RADIUS;
	/** Hauteur de la lumière du rayon au-dessus du point d'impact (sur l'axe).
	 * Assez haute pour que les reliefs projettent des ombres courtes et nettes
	 * (une source trop basse crée d'énormes ombres crénelées). */
	private readonly BEAM_LIGHT_H = 95;

	private scene: Scene;
	private world!: World;
	private terrainMaterial!: BABYLON.StandardMaterial;
	private chunkManager!: ChunkManager;
	private sunRay!: SunRayVolumetric;
	private rayLight!: BABYLON.PointLight;
	private shadowGen!: BABYLON.ShadowGenerator;
	private rayPos!: BABYLON.Vector3;
	/** Rideau cylindrique lumineux marquant la frontière de la zone accessible. */
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
		// Jamais modifié après coup et partagé par toutes les chunks de terrain
		// (jusqu'à ~80 en vue) : geler évite de revalider ses defines/bindings
		// à chaque mesh à chaque frame.
		this.terrainMaterial.freeze();

		const beamColor = new BABYLON.Color3(1.0, 0.9, 0.62);
		const strikeY = this.world.height(0, 0);
		this.rayPos = new BABYLON.Vector3(0, strikeY, 0);

		// Lumière ponctuelle SUR l'axe du rayon (et non un soleil incliné) : elle
		// rayonne depuis le faisceau, donc les murs face au rayon sont éclairés et
		// les ombres fuient radialement vers l'extérieur. Son falloff par distance
		// (`range` ≈ rayon de zone) éteint progressivement l'éclairage à l'approche
		// de la limite, au lieu d'une coupure nette.
		this.rayLight = new BABYLON.PointLight(
			'SunRayLight',
			new BABYLON.Vector3(0, strikeY + this.BEAM_LIGHT_H, 0),
			this.scene,
		);
		this.rayLight.diffuse = beamColor;
		this.rayLight.specular = new BABYLON.Color3(0.2, 0.18, 0.12);
		// Seule source de la scène (aucun ambient).
		this.rayLight.intensity = 13;
		// Portée = atteint le bord de zone depuis la nouvelle hauteur de source.
		this.rayLight.range = this.BEAM_LIGHT_H + this.ZONE_RADIUS - 40;
		this.rayLight.falloffType = BABYLON.Light.FALLOFF_STANDARD;

		// Cube shadow map 2048/face : bord d'ombre bien plus net (le crénelage en
		// escalier venait d'un 1024 étalé sur tout le champ de la lumière).
		this.shadowGen = new BABYLON.ShadowGenerator(2048, this.rayLight);
		this.shadowGen.usePercentageCloserFiltering = true;
		this.shadowGen.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
		this.shadowGen.bias = 0.0016;
		// normalBias plus fort : évite le « peter-panning » / l'acné sur les faces
		// obliques du terrain low-poly.
		this.shadowGen.normalBias = 0.7;
		// Un poil de lumière conservée : l'ombre lit comme de l'herbe sombre plutôt
		// qu'un aplat noir troué.
		this.shadowGen.setDarkness(0.12);
		// 1 frame sur 2 : le rayon avance lentement, le décalage d'ombre entre deux
		// refresh est imperceptible et ça évite de re-rasteriser 6 faces 2048 à
		// chaque frame.
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

		// FXAA en dernière passe (créé après le shaft, donc appliqué après lui) :
		// lisse les bords géométriques crénelés, compatible avec la chaîne de
		// post-process du rayon contrairement au MSAA du framebuffer principal.
		if (this.scene.activeCamera) {
			new BABYLON.FxaaPostProcess('fxaa', 1.0, this.scene.activeCamera);
		}

		this.createZoneBoundary(strikeY);

		// Lumières et matériaux de la scène sont figés une fois pour toutes ici :
		// plus besoin du scan qui remarque tous les matériaux "dirty" au moindre
		// changement de lumière/scène.
		this.scene.blockMaterialDirtyMechanism = true;
	}

	/**
	 * Frontière visible de la zone accessible : un rideau cylindrique lumineux au
	 * rayon `ZONE_RADIUS`, translucide et fondu vers le haut, ouvert (sans faces
	 * haut/bas). Il suit le rayon (voir {@link syncFromRoom}) et matérialise la
	 * limite où commencent les ténèbres, même quand le relief masque le sol.
	 */
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

		// Dégradé d'opacité vertical : dense au sol, s'efface vers le haut.
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
		mat.backFaceCulling = false; // visible depuis l'intérieur du disque
		mat.alphaMode = BABYLON.Constants.ALPHA_ADD; // lueur additive
		wall.material = mat;

		wall.isPickable = false;
		wall.receiveShadows = false;
		wall.doNotSyncBoundingInfo = true;
		wall.alwaysSelectAsActiveMesh = true; // grand + toujours pertinent
		wall.position.set(0, baseY, 0);
		this.zoneBoundary = wall;
	}

	/**
	 * Recale le rayon sur la position autoritative reçue du serveur : déplace le
	 * halo volumétrique, la lumière et la frontière de zone, mémorise le centre
	 * pour le clamp, et déclenche le streaming des chunks autour du rayon (le
	 * joueur reste borné dans ce disque, donc toujours dans la zone chargée).
	 */
	syncFromRoom(rayX: number, rayY: number, rayZ: number) {
		this.rayPos.set(rayX, rayY, rayZ);
		this.sunRay.setStrike(rayX, rayY, rayZ);
		this.rayLight.position.set(rayX, rayY + this.BEAM_LIGHT_H, rayZ);
		this.zoneBoundary.position.set(rayX, rayY, rayZ);
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
		this.zoneBoundary.material?.dispose();
		this.zoneBoundary.dispose();
	}
}
