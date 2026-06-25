import type { Engine, Scene } from '@babylonjs/core';
import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import * as COLYSEUS from 'colyseus.js';
import '@babylonjs/loaders/glTF/2.0';
import { InputManager } from '../InputManager';
import { World, ChunkManager } from '../world';
import { SunRayVolumetric } from '../effects/SunRayVolumetric';
import type { Vec3d } from '@transcendence/game-shared';

/** Distance de la lumière clé au point d'impact, le long de sa direction. */
const SUN_H = 150;

/** Rayon (unités) de la zone accessible, centrée sur le rayon de lumière. */
const ACCESS_RADIUS = 128;
/** Le rayon avance tout seul à cette vitesse (u/s) dans cette direction (normalisée). */
const RAY_SPEED = 1;
const RAY_DIR_X = 0;
const RAY_DIR_Z = 1;

export class GameScene {
	private scene!: Scene;
	private engine: Engine;
	private camera!: BABYLON.ArcRotateCamera;
	private world!: World;
	private terrainMaterial!: BABYLON.StandardMaterial;
	private chunkManager!: ChunkManager;
	private sunRay!: SunRayVolumetric;
	private rayLight!: BABYLON.SpotLight;
	private rayCenter!: BABYLON.Vector3;
	private shadowGen!: BABYLON.ShadowGenerator;
	private colyseusSDK!: COLYSEUS.Client;
	private input!: InputManager;
	private player!: BABYLON.AbstractMesh;
	private room!: GameRoom;

	private walkAnim!: BABYLON.AnimationGroup;

	public ready: Promise<void>;

	constructor(engine: Engine) {
		this.engine = engine;
		this.ready = this.init();
	}

	private async init() {
		this.createScene();
		this.initGUI();
		await this.connectToServer();
		await this.addPlayer();
		this.input = new InputManager(this.scene);
		this.initInput();
		this.initTerrainFollow();
	}

	render() {
		this.scene.render();
	}

	getScene() {
		return this.scene;
	}

	createScene() {
		this.scene = new BABYLON.Scene(this.engine);
		// Caméra 3ᵉ personne : orbite derrière le joueur (sa cible le suit chaque
		// frame, cf. initTerrainFollow), pivotable à la souris. C'est ELLE qui donne
		// l'avant : les déplacements WASD sont relatifs à la caméra (cf. initInput).
		this.camera = new BABYLON.ArcRotateCamera(
			'Player-Camera',
			-Math.PI / 2,
			1.0,
			14,
			new BABYLON.Vector3(0, 0, 0),
			this.scene,
		);
		this.camera.attachControl(true);
		this.camera.lowerRadiusLimit = 13;
		this.camera.upperRadiusLimit = 40;
		this.camera.lowerBetaLimit = 0.7;
		this.camera.upperBetaLimit = 1.45;
		this.camera.wheelDeltaPercentage = 0.02;
		this.camera.panningSensibility = 0;
		// Noir total : AUCUNE lumière d'ambiance. Tout ce qui n'est pas atteint par
		// le rayon reste noir — seul le rayon (spot + faisceau) éclaire. Ciel et
		// brouillard noirs pour que le hors-portée disparaisse dans le noir.
		this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);
		this.scene.ambientColor = new BABYLON.Color3(0, 0, 0);
		this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
		this.scene.fogColor = new BABYLON.Color3(0, 0, 0);
		// Brouillard plus dense : le terrain fond PROGRESSIVEMENT vers le noir avant
		// le bord des chunks -> bordure continue (plus de coupure nette à l'horizon).
		this.scene.fogDensity = 0.004;

		this.terrainMaterial = new BABYLON.StandardMaterial('terrain', this.scene);
		this.terrainMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
		this.terrainMaterial.specularColor = new BABYLON.Color3(0, 0, 0);

		this.world = new World(Math.floor(Math.random() * 1e9));

		// Le rayon est la SEULE source de lumière et SUIT le joueur (placé un peu
		// devant lui par updateRay), pour rester toujours visible sur une map
		// infinie sans englober la caméra :
		//   - un SpotLight chaud descend du ciel et éclaire réellement le sol autour
		//     de l'impact (le reste de la map reste dans le noir) ;
		//   - le SunRayVolumetric (post-process additif) dessine le faisceau visible.
		// Créé après la caméra (il lit la profondeur de la scène) — reste en WebGL2.
		this.scene.activeCamera = this.camera;
		const beamColor = new BABYLON.Color3(1.0, 0.9, 0.62);
		const strikeY = this.world.height(0, 0);
		this.rayCenter = new BABYLON.Vector3(0, strikeY, 0);

		// Lumière clé INCLINÉE (comme un soleil) mais visée sur le point d'impact
		// (position = impact - direction * H) : la flaque reste centrée sous le
		// faisceau, et l'angle éclaire les faces verticales (joueur + falaises) en
		// projetant des ombres. Cône large + exponent modéré => flaque large dont la
		// luminosité décroît PROGRESSIVEMENT jusqu'au noir (pas de coupure de cône).
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

		// Ombres projetées par le rayon (joueur + terrain), filtrage PCF doux. Shadow
		// map 4096 pour garder des ombres NETTES malgré la flaque large (la
		// résolution est étalée sur une plus grande zone).
		this.shadowGen = new BABYLON.ShadowGenerator(4096, this.rayLight);
		this.shadowGen.usePercentageCloserFiltering = true;
		// Bias + normalBias : évitent l'auto-ombrage (shadow acne) qui dessinait des
		// vagues/moiré sur le sol plat éclairé par le spot à incidence rasante.
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
		return this.scene;
	}

	initInput() {
		const dir = new BABYLON.Vector3();
		const move = new BABYLON.Vector3();
		this.scene.onBeforeRenderObservable.add(() => {
			const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.05);
			const speed = (this.input.isPressed('shift') ? 32 : 16) * dt;

			// "Avant" = de la caméra vers le joueur, projeté au sol : les WASD sont
			// donc relatifs à la CAMÉRA (c'est elle qui donne la direction).
			dir.copyFrom(this.player.position).subtractInPlace(this.camera.position);
			dir.y = 0;
			if (dir.lengthSquared() > 1e-4) dir.normalize();
			const right = BABYLON.Vector3.Cross(BABYLON.Axis.Y, dir);

			// Le personnage regarde TOUJOURS dans le sens de la caméra (dos à elle) :
			// quand on pivote la caméra, il tourne avec, en temps réel. Le modèle
			// glTF a un rotationQuaternion (conversion d'axes) qui ignorerait
			// rotation.y -> on pilote donc le quaternion.
			this.player.rotationQuaternion = BABYLON.Quaternion.RotationAxis(
				BABYLON.Axis.Y,
				Math.atan2(dir.x, dir.z),
			);

			move.set(0, 0, 0);
			if (this.input.isPressed('w')) move.addInPlace(dir);
			if (this.input.isPressed('s')) move.subtractInPlace(dir);
			if (this.input.isPressed('d')) move.addInPlace(right);
			if (this.input.isPressed('a')) move.subtractInPlace(right);

			if (move.lengthSquared() > 0) {
				move.normalize().scaleInPlace(speed);
				this.player.position.x += move.x;
				this.player.position.z += move.z;
				this.walkAnim.play();
			} else {
				this.walkAnim.stop();
			}

			const new_pos: Vec3d = {
				x: this.player.position.x,
				y: this.player.position.y,
				z: this.player.position.z,
			};
			this.room.send('move', new_pos);
		});
	}

	private initTerrainFollow() {
		this.scene.onBeforeRenderObservable.add(() => {
			const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.05);

			// Le rayon avance tout seul (il ne suit PAS le joueur).
			this.rayCenter.x += RAY_DIR_X * RAY_SPEED * dt;
			this.rayCenter.z += RAY_DIR_Z * RAY_SPEED * dt;
			this.rayCenter.y = this.world.height(this.rayCenter.x, this.rayCenter.z);

			// Zone accessible = cercle de rayon ACCESS_RADIUS autour du rayon : le
			// joueur y est confiné. Quand le rayon s'éloigne, le bord arrière le
			// rattrape et le REPOUSSE (on le ramène sur le cercle).
			const dx = this.player.position.x - this.rayCenter.x;
			const dz = this.player.position.z - this.rayCenter.z;
			const dist = Math.hypot(dx, dz);
			if (dist > ACCESS_RADIUS) {
				const k = ACCESS_RADIUS / dist;
				this.player.position.x = this.rayCenter.x + dx * k;
				this.player.position.z = this.rayCenter.z + dz * k;
			}

			// Snap du joueur au sol.
			const groundY = this.world.height(
				this.player.position.x,
				this.player.position.z,
			);
			this.player.position.y +=
				(groundY - this.player.position.y) * Math.min(1, dt * 14);

			this.camera.target.copyFrom(this.player.position);
			// Les chunks se génèrent (peu à peu) autour du RAYON, pas du joueur.
			this.chunkManager.update(this.rayCenter);
			this.updateRay();
		});
	}

	/** Place le rayon (spot + faisceau) sur sa position courante, posé au sol. */
	private updateRay() {
		const r = this.rayCenter;
		this.sunRay.setStrike(r.x, r.y, r.z);
		// La lumière reste visée sur l'impact : position = impact - direction * H.
		const d = this.rayLight.direction;
		this.rayLight.position.set(
			r.x - d.x * SUN_H,
			r.y - d.y * SUN_H,
			r.z - d.z * SUN_H,
		);
	}

	async addPlayer() {
		const result = await BABYLON.ImportMeshAsync(
			'/models/Player.glb',
			this.scene,
		);
		const model = result.meshes[0];
		model.position = new BABYLON.Vector3(0, this.world.height(0, 0), 0);
		model.scaling = new BABYLON.Vector3(1, 1, 1);
		model.isVisible = true;
		this.player = model;
		// Le joueur est éclairé par le rayon ET projette son ombre. Mais ses
		// PBRMaterial réagissent autrement que le terrain : on aligne leur falloff
		// (sinon l'inverse-carré annule la lumière à ~150 u) et on tamise fortement
		// leur réponse au spot (directIntensity bas) pour qu'il ne soit pas cramé
		// par l'intensité calibrée pour le terrain.
		for (const m of result.meshes) {
			this.shadowGen.addShadowCaster(m);
			const mat = m.material;
			if (mat instanceof BABYLON.PBRMaterial) {
				mat.usePhysicalLightFalloff = false;
				mat.directIntensity = 0.1;
			}
		}
		// Remplissage doux réservé au joueur (n'éclaire que lui, pas le terrain) pour
		// déboucher son côté à l'ombre du soleil. Intensité forte car directIntensity
		// la divise aussi (≈ 1.0 effectif).
		const playerLight = new BABYLON.HemisphericLight(
			'PlayerLight',
			new BABYLON.Vector3(-0.4, 0.82, -0.3),
			this.scene,
		);
		playerLight.diffuse = new BABYLON.Color3(1.0, 0.92, 0.72);
		playerLight.groundColor = new BABYLON.Color3(0.55, 0.5, 0.42);
		playerLight.intensity = 10;
		playerLight.includedOnlyMeshes = result.meshes;
		this.walkAnim = result.animationGroups[0];
		this.walkAnim.stop();
	}

	async connectToServer() {
		try {
			this.colyseusSDK = new COLYSEUS.Client('ws://localhost:4000');
			this.room = await this.colyseusSDK.joinOrCreate('game');
		} catch (error) {
			console.log('ERROR SUUUUUUUUUUUUU');
		}
	}

	initGUI() {
		const ui = GUI.AdvancedDynamicTexture.CreateFullscreenUI('UI');
		const debugMenu = new GUI.Rectangle('debugMenu');

		debugMenu.width = '400px';
		debugMenu.height = '600px';
		debugMenu.cornerRadius = 10;
		debugMenu.thickness = 1;
		debugMenu.color = 'white';
		debugMenu.background = 'rgba(20, 20, 20, 0.85)';
		debugMenu.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
		debugMenu.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
		debugMenu.left = '-12px';
		debugMenu.top = '12px';
		ui.addControl(debugMenu);

		const panel = new GUI.StackPanel();
		panel.paddingTop = '10px';
		panel.paddingRight = '10px';
		panel.paddingLeft = '10px';
		panel.spacing = 0;
		debugMenu.addControl(panel);

		const title = new GUI.TextBlock();
		title.text = 'Debug Menu';
		title.height = '30px';
		title.color = 'white';
		title.fontSize = 22;
		title.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
		title.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
		panel.addControl(title);
	}
}
