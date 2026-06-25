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

export class GameScene {
	private scene!: Scene;
	private engine: Engine;
	private camera!: BABYLON.FollowCamera;
	private world!: World;
	private terrainMaterial!: BABYLON.StandardMaterial;
	private chunkManager!: ChunkManager;
	private sunRay!: SunRayVolumetric;
	private rayLight!: BABYLON.SpotLight;
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
		this.camera = new BABYLON.FollowCamera(
			'Player-Camera',
			new BABYLON.Vector3(0, 10, -10),
			this.scene,
		);
		this.camera.radius = 5;
		this.camera.heightOffset = 10;
		this.camera.rotationOffset = 180;
		this.camera.cameraAcceleration = 0.05;
		this.camera.maxCameraSpeed = 2;
		this.camera.attachControl(true);
		// Noir total : AUCUNE lumière d'ambiance. Tout ce qui n'est pas atteint par
		// le rayon reste noir — seul le rayon (spot + faisceau) éclaire. Ciel et
		// brouillard noirs pour que le hors-portée disparaisse dans le noir.
		this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);
		this.scene.ambientColor = new BABYLON.Color3(0, 0, 0);
		this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
		this.scene.fogColor = new BABYLON.Color3(0, 0, 0);
		this.scene.fogDensity = 0.0022;

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

		// Lumière clé INCLINÉE (comme un soleil) mais visée sur le point d'impact
		// (position = impact - direction * H) : la flaque reste centrée sous le
		// faisceau, et l'angle éclaire les faces verticales (joueur + falaises) en
		// projetant des ombres. Cône resserré + exponent élevé => la luminosité
		// décroît quand même PROGRESSIVEMENT (pas de coupure de cône) ET la shadow
		// map garde assez de résolution pour des ombres nettes.
		const sunDir = new BABYLON.Vector3(0.6, -0.62, 0.5);
		this.rayLight = new BABYLON.SpotLight(
			'SunRayLight',
			new BABYLON.Vector3(
				-sunDir.x * SUN_H,
				strikeY - sunDir.y * SUN_H,
				-sunDir.z * SUN_H,
			),
			sunDir,
			1.2,
			12,
			this.scene,
		);
		this.rayLight.diffuse = beamColor;
		this.rayLight.specular = new BABYLON.Color3(0.2, 0.18, 0.12);
		this.rayLight.intensity = 60;
		this.rayLight.range = 360;
		this.rayLight.shadowMinZ = 40;
		this.rayLight.shadowMaxZ = 300;

		// Ombres projetées par le rayon (joueur + terrain), filtrage PCF doux.
		this.shadowGen = new BABYLON.ShadowGenerator(2048, this.rayLight);
		this.shadowGen.usePercentageCloserFiltering = true;
		this.shadowGen.setDarkness(0.08);

		this.chunkManager = new ChunkManager(
			this.scene,
			this.world,
			this.terrainMaterial,
			{
				viewDistance: 3,
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
			radius: 12,
			height: 140,
			intensity: 1.0,
		});
		return this.scene;
	}

	initInput() {
		this.scene.onBeforeRenderObservable.add(() => {
			let newPlayer = this.player;

			let moving = false;
			let running = false;
			if (this.input.isPressed('shift')) {
				running = true;
			}
			let speed = running ? 0.5 : 0.1;
			if (this.input.isPressed('w')) {
				newPlayer.translate(BABYLON.Axis.Z, speed, BABYLON.Space.LOCAL);
				moving = true;
			}
			if (this.input.isPressed('s')) {
				newPlayer.translate(
					BABYLON.Axis.Z,
					-speed,
					BABYLON.Space.LOCAL,
				);
				moving = true;
			}
			if (this.input.isPressed('d')) {
				newPlayer.rotate(BABYLON.Axis.Y, 0.05, BABYLON.Space.LOCAL);
				moving = true;
			}
			if (this.input.isPressed('a')) {
				newPlayer.rotate(BABYLON.Axis.Y, -0.05, BABYLON.Space.LOCAL);
				moving = true;
			}
			if (moving) this.walkAnim.play();
			if (
				this.input.isReleased('w') &&
				this.input.isReleased('s') &&
				this.input.isReleased('a') &&
				this.input.isReleased('d')
			) {
				this.walkAnim.stop();
				moving = false;
			}
			const new_pos: Vec3d = {
				x: newPlayer.position.x,
				y: newPlayer.position.y,
				z: newPlayer.position.z,
			};
			this.room.send('move', new_pos);
		});
	}

	private initTerrainFollow() {
		this.scene.onBeforeRenderObservable.add(() => {
			const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.05);
			const groundY = this.world.height(
				this.player.position.x,
				this.player.position.z,
			);
			this.player.position.y +=
				(groundY - this.player.position.y) * Math.min(1, dt * 14);
			this.chunkManager.update(this.player.position);
			this.updateRay();
		});
	}

	/** Replace le rayon (spot + faisceau) un peu devant le joueur, posé au sol. */
	private updateRay() {
		const p = this.player.position;
		const cam = this.camera.position;
		let fx = p.x - cam.x;
		let fz = p.z - cam.z;
		const len = Math.hypot(fx, fz) || 1;
		fx /= len;
		fz /= len;
		const ahead = 14;
		const bx = p.x + fx * ahead;
		const bz = p.z + fz * ahead;
		const groundY = this.world.height(bx, bz);
		this.sunRay.setStrike(bx, groundY, bz);
		// La lumière reste visée sur l'impact : position = impact - direction * H.
		const d = this.rayLight.direction;
		this.rayLight.position.set(
			bx - d.x * SUN_H,
			groundY - d.y * SUN_H,
			bz - d.z * SUN_H,
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
		this.camera.lockedTarget = model;
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
			new BABYLON.Vector3(-0.6, 0.62, -0.5),
			this.scene,
		);
		playerLight.diffuse = new BABYLON.Color3(1.0, 0.92, 0.72);
		playerLight.groundColor = new BABYLON.Color3(0.3, 0.26, 0.2);
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
