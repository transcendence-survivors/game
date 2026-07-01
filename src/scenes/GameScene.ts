import type { Engine, Scene } from '@babylonjs/core';
import * as BABYLON from '@babylonjs/core';
import * as COLYSEUS from '@colyseus/sdk';
import '@babylonjs/loaders/glTF/2.0';
import { InputManager } from '../InputManager';
import {
	applyMovement,
	type MoveInput,
	type MovementState,
} from '../../../shared-package';
import type { GameState } from '@transcendence/game-shared';
import { MapGenerator } from '../map/MapGenerator';
import { DebugMenu } from '../DebugMenu';
import { ServerOrchestrator } from '../ServerOrchestrator';
import { getCameraYaw } from '../../../shared-package/src/states/GameState';

const FORWARD_KEY = 'w';
const BACKWARD_KEY = 's';
const LEFT_KEY = 'a';
const RIGHT_KEY = 'd';

export class GameScene {
	private scene!: Scene;
	private engine: Engine;
	private camera!: BABYLON.ArcRotateCamera;
	private input!: InputManager;
	private player!: BABYLON.AbstractMesh;
	private room!: COLYSEUS.Room<GameState>;
	private mapGen!: MapGenerator;
	private debugMenu!: DebugMenu;

	private walkAnim!: BABYLON.AnimationGroup;

	private pendingInputs: MoveInput[] = [];
	private seq = 0;

	private server!: ServerOrchestrator;

	constructor(engine: Engine) {
		this.engine = engine;
		this.init();
	}

	private async init() {
		try {
			this.createScene();
			this.createCamera();
			this.debugMenu = new DebugMenu(this.engine);
			this.debugMenu.initGUI();
			this.server = new ServerOrchestrator(this.scene);
			await this.server.connect();
			this.mapGen = this.server.getMapGen();
			this.room = this.server.getRoom();
			await this.addPlayer();
			this.input = new InputManager(this.scene);
			this.initInput();
			this.server.listenToState();
		} catch (e) {
			console.error('init failed', e);
		}
	}

	render() {
		this.scene.render();
	}

	dispose() {
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
			10,
			new BABYLON.Vector3(0, 0, 0),
			this.scene,
		);
		this.camera.inputs.clear();
		this.camera.lowerBetaLimit = 0.2;
		this.camera.upperBetaLimit = 1.4;
		this.camera.lowerRadiusLimit = 5;
		this.camera.upperRadiusLimit = 20;
		this.camera.inertia = 0.85;
		this.camera.checkCollisions = true;
		this.scene.activeCamera = this.camera;
		this.camera.fov = 1.5;

		const canvas = this.scene.getEngine().getRenderingCanvas();

		canvas?.addEventListener('click', () => {
			canvas.requestPointerLock();
		});

		const sensitivity = 0.0025;

		document.addEventListener('mousemove', (e) => {
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

	private createScene() {
		this.scene = new BABYLON.Scene(this.engine);
		// Aucune lumière d'ambiance : le rayon (lumière ponctuelle de MapGenerator)
		// est la SEULE source. Les faces non atteintes et les ombres portées sont
		// donc franches, au lieu d'être délavées par un fill hémisphérique.

		// Tone mapping filmique (ACES) : comprime les hautes lumières du rayon
		// (qui sinon cramaient le sol en blanc pur en rendu linéaire) et donne des
		// dégradés d'éclairage plus réalistes.
		const ip = this.scene.imageProcessingConfiguration;
		ip.toneMappingEnabled = true;
		ip.toneMappingType =
			BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
		ip.exposure = 1.2;
		ip.contrast = 1.1;
	}

	private initInput() {
		let lastTime = performance.now();
		// let sendAccumulator = 0;
		// const SEND_RATE = 1 / 20;
		this.scene.onBeforeRenderObservable.add(() => {
			const now = performance.now();
			const deltaTime = (now - lastTime) / 1000;
			lastTime = now;
			// sendAccumulator += deltaTime;
			const cameraYaw = getCameraYaw(
				this.camera.getDirection(BABYLON.Vector3.Forward()),
			);
			const input: MoveInput = {
				seq: ++this.seq,
				forward: this.input.isPressed(FORWARD_KEY),
				backward: this.input.isPressed(BACKWARD_KEY),
				right: this.input.isPressed(RIGHT_KEY),
				left: this.input.isPressed(LEFT_KEY),
				deltaTime,
				// Le serveur rejoue applyMovement avec ce yaw pour rester autoritatif.
				cameraYaw,
			};
			const moving =
				input.forward || input.backward || input.right || input.left;
			moving ? this.walkAnim.play() : this.walkAnim.stop();
			const currentState: MovementState = {
				x: this.player.position.x,
				z: this.player.position.z,
				rotationY: this.player.rotation.y,
			};
			const newState = applyMovement(currentState, input, cameraYaw);
			// Le rayon est autoritatif serveur : on lit sa position dans l'état de
			// la room, on recale halo/lumière/chunks dessus, puis on prédit le clamp
			// de zone (le serveur le réapplique et réconcilie).
			if (this.mapGen && this.room?.state) {
				const { rayX, rayY, rayZ } = this.room.state;
				this.mapGen.syncFromRoom(rayX, rayY, rayZ);
				const clamped = this.mapGen.clampToZone(newState.x, newState.z);
				newState.x = clamped.x;
				newState.z = clamped.z;
			}
			this.player.position.x = newState.x;
			this.player.position.z = newState.z;
			this.player.rotation.y = newState.rotationY;
			this.pendingInputs.push(input);
			// if (sendAccumulator >= SEND_RATE) {
			// 	if (this.room) this.room.send('move', input);
			// 	sendAccumulator = 0;
			// }
			this.room.send('move', input);
			if (this.mapGen) {
				const groundY = this.mapGen.getGroundHeight(
					this.player.position.x,
					this.player.position.z,
				);
				this.player.position.y +=
					(groundY - this.player.position.y) *
					Math.min(1, deltaTime * 14);
			}
			this.server.updateRemotePlayers(deltaTime);
			this.camera.target.copyFrom(this.player.position);
			this.debugMenu.updateDebugMenu(this.player);
		});
	}

	private async addPlayer() {
		const result = await BABYLON.ImportMeshAsync(
			'/models/Player.glb',
			this.scene,
		);
		const model = result.meshes[0];
		const startY = this.mapGen.getGroundHeight(0, 0);
		model.position = new BABYLON.Vector3(0, startY, 0);
		model.scaling = new BABYLON.Vector3(1, 1, 1);
		model.isVisible = true;
		this.camera.lockedTarget = model;
		this.player = model;
		this.walkAnim = result.animationGroups[0];
		this.walkAnim.stop();
		model.rotationQuaternion = null;
		this.mapGen.addShadowCaster(model);
	}
}
