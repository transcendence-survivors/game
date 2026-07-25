import type { Engine, Scene } from '@babylonjs/core';
import * as BABYLON from '@babylonjs/core';
import * as COLYSEUS from '@colyseus/sdk';
import '@babylonjs/loaders/glTF/2.0';
import { InputManager } from '../InputManager';
import { MapGenerator } from '../map/MapGenerator';
import { DebugMenu } from '../DebugMenu';
import { ServerOrchestrator } from '../ServerOrchestrator';
import { MonsterRenderer } from '../monsters';
import { PlayerHud } from '../hud/PlayerHud';

import {
	type MoveInput,
	type MovementState,
	GameState,
	getCameraYaw,
	resolveTerrainCollision,
	applyHorizontalMovement,
	applyVerticalMovement,
} from '../../../shared-package';
import { SettingsMenuRender } from '../settings/SettingsMenuRender';
import { models } from '../assets/models';
//TODO FIX THE @module bug

// const FORWARD_KEY = 'w';
// const BACKWARD_KEY = 's';
// const LEFT_KEY = 'a';
// const RIGHT_KEY = 'd';
// const JUMP_KEY = ' ';

export interface KeyBindings {
	forward: string;
	backward: string;
	left: string;
	right: string;
	jump: string;
}

// export const KeyBindings = {
// 	forward: 'w',
// 	backward: 's',
// 	left: 'a',
// 	right: 'd',
// 	jump: ' ',
// };

// Plans de clipping calés sur l'échelle réelle du jeu. Le near plane par défaut
// de Babylon (1 unité) tranche tout ce qui passe entre la caméra et le joueur —
// typiquement un boss au corps-à-corps, mis à l'échelle 2.5 — et comme les
// modèles sont backface-culled on voit alors l'intérieur du maillage : de
// grandes facettes qui traversent l'écran. Le far plane par défaut (10000) est
// lui très au-delà du terrain chargé et ne fait que gaspiller la précision du
// depth buffer, que le rayon volumétrique relit. La borne retenue couvre le pire
// cas : demi-diagonale de la grille de chunks (9 x 48 unités, centrée sur le
// rayon, soit ~305) plus l'écart maximal joueur <-> rayon (~128).
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 600;

// Distance caméra -> joueur souhaitée, et distance minimale quand le relief
// s'interpose.
const CAMERA_RADIUS = 10;
const CAMERA_MIN_RADIUS = 2.5;
// Marge conservée au-dessus du sol à pleine distance, en dessous de laquelle la
// caméra passerait sous le terrain. Elle est appliquée AU PRORATA de la distance
// sondée : le pivot est aux pieds du joueur, donc la ligne de visée y est à ras
// du sol par construction — une marge constante déclencherait le rapprochement
// dès la première sonde, même sur un terrain parfaitement plat.
const CAMERA_GROUND_CLEARANCE = 0.8;
// Sondes réparties le long du segment joueur -> caméra.
const CAMERA_PROBES = 8;
// Vitesse de retour vers la distance nominale une fois l'obstacle passé. Le
// rapprochement, lui, est immédiat : mieux vaut un recadrage sec qu'une frame
// avec la caméra dans la falaise.
const CAMERA_RETURN_SPEED = 6;

export class GameScene {
	private scene!: Scene;
	private engine: Engine;
	private camera!: BABYLON.ArcRotateCamera;
	private input!: InputManager;
	private player!: BABYLON.AbstractMesh;
	private mapGen!: MapGenerator;
	private debugMenu!: DebugMenu;
	// private light!: BABYLON.Light;

	// TO MOVE LATER
	public keybinds: KeyBindings = {
		forward: 'w',
		backward: 's',
		left: 'a',
		right: 'd',
		jump: ' ',
	};

	private settingsOpened: boolean = false;

	private settings!: SettingsMenuRender;

	private walkAnim!: BABYLON.AnimationGroup;

	private seq = 0;
	private jumpKeyWasPressed = false;

	private settingsKeyWasPressed = false;

	private server!: ServerOrchestrator;
	private monsters!: MonsterRenderer;
	private hud!: PlayerHud;
	public readonly ready: Promise<void>;

	constructor(engine: Engine, room: COLYSEUS.Room<GameState>) {
		this.engine = engine;
		this.ready = this.init(room);
	}

	private async init(room: COLYSEUS.Room<GameState>) {
		try {
			this.createScene();
			this.createCamera();
			this.settings = new SettingsMenuRender(
				this.engine,
				this.scene,
				this.camera,
				this.keybinds,
			);
			await this.settings.ready;
			this.settings.closeSettings();
			this.debugMenu = new DebugMenu(this.engine);
			this.debugMenu.initGUI();
			this.server = new ServerOrchestrator(this.scene, room);
			await this.server.connect();
			this.mapGen = this.server.getMapGen();
			await this.addPlayer();
			this.server.setPlayer(this.player);
			this.input = new InputManager(this.scene);
			this.initInput();
			this.server.listenToState();
			this.monsters = new MonsterRenderer(this.scene, room, this.mapGen);
			this.monsters.listen();
			this.hud = new PlayerHud(room);
		} catch (e) {
			console.error('init failed', e);
		}
	}

	render() {
		this.scene.render();
	}

	dispose() {
		this.hud?.dispose();
		this.monsters?.dispose();
		this.scene.dispose();
		this.mapGen.dispose();
	}

	getScene() {
		return this.scene;
	}

	private createCamera() {
		this.camera = new BABYLON.ArcRotateCamera(
			'Player-Camera',
			-Math.PI / 2,
			1.0,
			CAMERA_RADIUS,
			new BABYLON.Vector3(0, 0, 0),
			this.scene,
		);
		this.camera.inputs.clear();
		this.camera.lowerBetaLimit = 0.2;
		this.camera.upperBetaLimit = 1.4;
		// La borne basse doit laisser passer le rapprochement anti-terrain :
		// `_checkLimits` remonterait sinon le rayon calculé par frame.
		this.camera.lowerRadiusLimit = CAMERA_MIN_RADIUS;
		this.camera.upperRadiusLimit = CAMERA_RADIUS;
		this.camera.inertia = 0.85;
		this.camera.minZ = CAMERA_NEAR;
		this.camera.maxZ = CAMERA_FAR;
		this.scene.activeCamera = this.camera;
		this.camera.fov = 1.5;

		const canvas = this.scene.getEngine().getRenderingCanvas();

		canvas?.addEventListener('click', async () => {
			console.log('canvas click, settings open?', this.settings.isOpen());
			if (this.settings.isOpen()) return;
			await canvas.requestPointerLock();
		});

		const sensitivity = 0.0025;

		document.addEventListener('mousemove', (e) => {
			if (this.settings.isOpen()) return;
			if (document.pointerLockElement === canvas) {
				this.camera.alpha -= e.movementX * sensitivity;
				this.camera.beta -= e.movementY * sensitivity;
				this.camera.beta = Math.max(
					this.camera.lowerBetaLimit as number,
					Math.min(
						this.camera.upperBetaLimit as number,
						this.camera.beta,
					),
				);
			}
		});
	}

	/**
	 * Rapproche la caméra du joueur tant que le relief s'interpose. Aucun mesh
	 * de la scène ne porte de collision (les chunks sont même non pickables),
	 * donc rien n'empêchait la caméra d'entrer dans une falaise — on voyait
	 * alors à travers le terrain, ses triangles tranchés par le near plane.
	 *
	 * La hauteur du sol étant analytique (`World.height`), quelques sondes le
	 * long du segment joueur -> caméra suffisent : pas de raycast sur les meshes.
	 */
	private clampCameraToTerrain(deltaTime: number) {
		const target = this.camera.target;
		const sinBeta = Math.sin(this.camera.beta);
		// Décomposition de la position d'une ArcRotateCamera :
		// position = target + radius * (cosA*sinB, cosB, sinA*sinB).
		const dirX = Math.cos(this.camera.alpha) * sinBeta;
		const dirY = Math.cos(this.camera.beta);
		const dirZ = Math.sin(this.camera.alpha) * sinBeta;

		let radius = CAMERA_RADIUS;
		for (let i = 1; i <= CAMERA_PROBES; i++) {
			const probe = (CAMERA_RADIUS * i) / CAMERA_PROBES;
			const ground = this.mapGen.getGroundHeight(
				target.x + dirX * probe,
				target.z + dirZ * probe,
			);
			const clearance = (CAMERA_GROUND_CLEARANCE * probe) / CAMERA_RADIUS;
			if (target.y + dirY * probe < ground + clearance) {
				// On garde la dernière sonde dégagée.
				radius = (CAMERA_RADIUS * (i - 1)) / CAMERA_PROBES;
				break;
			}
		}
		const desired = Math.max(CAMERA_MIN_RADIUS, radius);
		this.camera.radius =
			desired < this.camera.radius
				? desired
				: BABYLON.Scalar.Lerp(
						this.camera.radius,
						desired,
						Math.min(1, deltaTime * CAMERA_RETURN_SPEED),
					);
	}

	private createScene() {
		this.scene = new BABYLON.Scene(this.engine);
		// this.light = new BABYLON.HemisphericLight(
		// 'Light',
		// new BABYLON.Vector3(0, 40, 0),
		// this.scene,
		// );
		// this.light.intensity = 0.5;
	}

	private initInput() {
		let lastTime = performance.now();
		this.scene.onBeforeRenderObservable.add(() => {
			const now = performance.now();
			const deltaTime = (now - lastTime) / 1000;
			lastTime = now;
			const cameraYaw = getCameraYaw(
				this.camera.getDirection(BABYLON.Vector3.Forward()),
			);
			const jumpKeyPressed = this.input.isPressed(this.keybinds.jump);
			const jumpTriggered = jumpKeyPressed && !this.jumpKeyWasPressed;
			this.jumpKeyWasPressed = jumpKeyPressed;
			const input: MoveInput = {
				seq: ++this.seq,
				forward: this.input.isPressed(this.keybinds.forward),
				backward: this.input.isPressed(this.keybinds.backward),
				right: this.input.isPressed(this.keybinds.right),
				left: this.input.isPressed(this.keybinds.left),
				jump: jumpTriggered,
				deltaTime,
				cameraYaw,
			};
			const moving =
				input.forward || input.backward || input.right || input.left;
			moving ? this.walkAnim.play() : this.walkAnim.stop();
			const currentState = this.server.getMovementState();
			const world = this.mapGen.getWorld();
			const horizontalMove = applyHorizontalMovement(
				currentState,
				input,
				input.cameraYaw,
			);
			const resolved = resolveTerrainCollision(
				world,
				{
					x: currentState.x,
					z: currentState.z,
				},
				{ x: horizontalMove.x, z: horizontalMove.z },
				currentState.y,
			);
			const groundHeight = world.height(resolved.x, resolved.z);
			const verticalMove = applyVerticalMovement(
				currentState.y,
				currentState.velocityY,
				currentState.isGrounded,
				groundHeight,
				input,
			);
			const newState: MovementState = {
				x: resolved.x,
				z: resolved.z,
				rotationY: horizontalMove.rotationY,
				y: verticalMove.y,
				velocityY: verticalMove.velocityY,
				isGrounded: verticalMove.isGrounded,
			};
			this.server.setMovementState(newState);
			this.player.position.x = newState.x;
			this.player.position.y = newState.y;
			this.player.position.z = newState.z;
			this.player.rotation.y = newState.rotationY;
			this.server.pushPendingInput(input);
			this.server.send('move', input);
			if (this.mapGen && this.server.getRoom()?.state) {
				const { rayX, rayY, rayZ } = this.server.getRoom().state;
				this.mapGen.syncFromRoom(rayX, rayY, rayZ);
			}
			this.server.updateRemotePlayers(deltaTime);
			this.mapGen.updateAuras(this.server.collectAuras(), deltaTime);
			this.monsters?.update(deltaTime);
			this.camera.target.copyFrom(this.player.position);
			this.clampCameraToTerrain(deltaTime);
			this.hud.update();
			this.debugMenu.updateDebugMenu(this.player);
		});
		this.scene.onBeforeRenderObservable.add(() => {
			const pKeyPressed = this.input.isPressed('p');
			const pTriggered = pKeyPressed && !this.settingsKeyWasPressed;
			this.settingsKeyWasPressed = pKeyPressed;
			if (pTriggered) {
				document.exitPointerLock();
				this.settingsOpened = !this.settingsOpened;
				this.settingsOpened
					? this.settings.openSettings()
					: this.settings.closeSettings();
			}
		});
	}

	private async addPlayer() {
		const result = await BABYLON.ImportMeshAsync(models.player, this.scene);
		const model = result.meshes[0];
		// Démarrer sur la position de spawn décidée par le serveur (zone
		// dégagée, jamais dans un mur) ; repli au centre si l'état n'est pas
		// encore synchronisé, le premier reconcile corrigera alors.
		const spawn = this.server.getLocalSpawn();
		const startX = spawn?.x ?? 0;
		const startZ = spawn?.z ?? 0;
		const startY = spawn?.y ?? this.mapGen.getGroundHeight(startX, startZ);
		model.position = new BABYLON.Vector3(startX, startY, startZ);
		model.scaling = new BABYLON.Vector3(1, 1, 1);
		model.isVisible = true;
		this.camera.lockedTarget = model;
		this.player = model;
		this.walkAnim = result.animationGroups[0];
		this.walkAnim.stop();
		model.rotationQuaternion = null;
		this.mapGen.addShadowCaster(model);
		this.server.setMovementState({
			x: startX,
			y: startY,
			z: startZ,
			rotationY: 0,
			velocityY: 0,
			isGrounded: true,
		});
	}
}
