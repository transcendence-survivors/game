import type { Engine, Scene } from '@babylonjs/core';
import * as BABYLON from '@babylonjs/core';
import * as COLYSEUS from '@colyseus/sdk';
import '@babylonjs/loaders/glTF/2.0';
import { InputManager } from '../InputManager';
import { MapGenerator } from '../map/MapGenerator';
import { DebugMenu } from '../DebugMenu';
import { ServerOrchestrator } from '../ServerOrchestrator';

import {
	type MoveInput,
	type MovementState,
	GameState,
	getCameraYaw,
	resolveTerrainCollision,
	applyHorizontalMovement,
	applyVerticalMovement,
} from '../../../shared-package';
//TODO FIX THE @module bug

const FORWARD_KEY = 'w';
const BACKWARD_KEY = 's';
const LEFT_KEY = 'a';
const RIGHT_KEY = 'd';
const JUMP_KEY = ' ';

export class GameScene {
	private scene!: Scene;
	private engine: Engine;
	private camera!: BABYLON.ArcRotateCamera;
	private input!: InputManager;
	private player!: BABYLON.AbstractMesh;
	private room!: COLYSEUS.Room<GameState>;
	private mapGen!: MapGenerator;
	private debugMenu!: DebugMenu;
	private light!: BABYLON.Light;

	private walkAnim!: BABYLON.AnimationGroup;

	private pendingInputs: MoveInput[] = [];
	private seq = 0;
	private jumpKeyWasPressed = false;

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
			this.server.setPlayer(this.player);
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
		// const ip = this.scene.imageProcessingConfiguration;
		// ip.toneMappingEnabled = true;
		// ip.toneMappingType =
		// 	BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
		// ip.exposure = 1.2;
		// ip.contrast = 1.1;
		this.light = new BABYLON.HemisphericLight(
			'Light',
			new BABYLON.Vector3(0, 40, 0),
			this.scene,
		);
		this.light.intensity = 0.5;
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
			const jumpKeyPressed = this.input.isPressed(JUMP_KEY);
			const jumpTriggered = jumpKeyPressed && !this.jumpKeyWasPressed;
			this.jumpKeyWasPressed = jumpKeyPressed;
			const input: MoveInput = {
				seq: ++this.seq,
				forward: this.input.isPressed(FORWARD_KEY),
				backward: this.input.isPressed(BACKWARD_KEY),
				right: this.input.isPressed(RIGHT_KEY),
				left: this.input.isPressed(LEFT_KEY),
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
			this.pendingInputs.push(input);
			this.server.pushPendingInput(input);
			this.room.send('move', input);
			if (this.mapGen && this.room?.state) {
				const { rayX, rayY, rayZ } = this.room.state;
				this.mapGen.syncFromRoom(rayX, rayY, rayZ);
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
		this.server.setMovementState({
			x: 0,
			y: startY,
			z: 0,
			rotationY: 0,
			velocityY: 0,
			isGrounded: true,
		});
	}
}
