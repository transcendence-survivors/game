import type { Engine, Scene } from '@babylonjs/core';
import * as BABYLON from '@babylonjs/core';
import * as COLYSEUS from '@colyseus/sdk';
import '@babylonjs/loaders/glTF/2.0';
import { InputManager } from '../InputManager';
import { MapGenerator } from '../map/MapGenerator';
import { DebugMenu } from '../DebugMenu';
import { ServerOrchestrator } from '../ServerOrchestrator';
import { MonsterRenderer } from '../monsters';

import {
	type MoveInput,
	type MovementState,
	GameState,
	getCameraYaw,
	resolveTerrainCollision,
	applyHorizontalMovement,
	applyVerticalMovement,
	ClientMessage,
} from '../../../shared-package';
import { SettingsMenuRender } from '../settings/SettingsMenuRender';
import { models } from '../assets/models';
import { Hud } from '../hud/Hud';
import { LevelUpMenu } from '../LevelUpMenu';
//TODO FIX THE @module bug

export interface KeyBindings {
	forward: string;
	backward: string;
	left: string;
	right: string;
	jump: string;
}

const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 600;
const CAMERA_RADIUS = 10;
const CAMERA_MIN_RADIUS = 2.5;
const CAMERA_GROUND_CLEARANCE = 0.8;
const CAMERA_PROBES = 8;
const CAMERA_RETURN_SPEED = 6;

export class GameScene {
	private scene!: Scene;
	private engine: Engine;
	private camera!: BABYLON.ArcRotateCamera;
	private input!: InputManager;
	private player!: BABYLON.AbstractMesh;
	private mapGen!: MapGenerator;
	private debugMenu!: DebugMenu;

	// TO MOVE LATER
	public keybinds: KeyBindings = {
		forward: 'w',
		backward: 's',
		left: 'a',
		right: 'd',
		jump: ' ',
	};

	private settings!: SettingsMenuRender;

	private walkAnim!: BABYLON.AnimationGroup;

	private seq = 0;
	private jumpKeyWasPressed = false;

	private settingsKeyWasPressed = false;

	private server!: ServerOrchestrator;
	private monsters!: MonsterRenderer;
	// private hud!: PlayerHud;
	private hud!: Hud;
	private levelUpMenu!: LevelUpMenu;
	public readonly ready: Promise<void>;

	constructor(engine: Engine, room: COLYSEUS.Room<GameState>) {
		this.engine = engine;
		this.ready = this.init(room);
	}

	private async init(room: COLYSEUS.Room<GameState>) {
		try {
			this.createScene();
			this.createCamera();

			this.server = new ServerOrchestrator(this.scene, room);
			const seedReady = this.server.connect();
			this.settings = new SettingsMenuRender(
				this.engine,
				this.scene,
				this.camera,
				this.keybinds,
			);
			await this.settings.ready;
			this.settings.close();
			this.debugMenu = new DebugMenu(this.engine);

			await seedReady;
			this.mapGen = this.server.getMapGen();

			await this.addPlayer();

			this.server.setPlayer(this.player);
			this.input = new InputManager(this.scene);
			this.renderLoop();
			this.server.listenToState();
			this.monsters = new MonsterRenderer(this.scene, room, this.mapGen);
			this.monsters.listen();

			this.hud = new Hud(this.engine, this.scene, room);
			await this.hud.ready;

			this.levelUpMenu = new LevelUpMenu(this.scene, room);
			await this.levelUpMenu.ready;
		} catch (e) {
			console.error('init failed', e);
		}
	}

	render() {
		this.scene.render();
	}

	dispose() {
		const canvas = this.engine.getRenderingCanvas();
		canvas?.removeEventListener('pointerdown', this.boundOnClick);
		document.removeEventListener('mousemove', this.boundOnMouseMove);
		this.input?.dispose();
		this.server?.dispose();
		this.server.getRoom().leave();
		this.hud.dispose();
		this.monsters.dispose();
		this.mapGen.dispose();
		this.levelUpMenu.dispose();
		this.scene.dispose();
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
		this.camera.lowerRadiusLimit = CAMERA_MIN_RADIUS;
		this.camera.upperRadiusLimit = CAMERA_RADIUS;
		this.camera.inertia = 0.85;
		this.camera.minZ = CAMERA_NEAR;
		this.camera.maxZ = CAMERA_FAR;
		this.scene.activeCamera = this.camera;
		this.camera.fov = 1.5;

		const canvas = this.scene.getEngine().getRenderingCanvas();
		canvas?.addEventListener('pointerdown', this.boundOnClick);
		document.addEventListener('mousemove', this.boundOnMouseMove);
	}

	private clampCameraToTerrain(deltaTime: number) {
		const target = this.camera.target;
		const sinBeta = Math.sin(this.camera.beta);
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
	}

	private renderLoop() {
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
			const room = this.server.getRoom();
			const playerInRoom = room.state.players.get(room.sessionId);
			if (!playerInRoom) return;
			const horizontalMove = applyHorizontalMovement(
				currentState,
				input,
				input.cameraYaw,
				playerInRoom.stats.moveSpeed,
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
			this.server.send(ClientMessage.Move, input);
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
		this.scene.onBeforeRenderObservable.add(async () => {
			const pKeyPressed = this.input.isPressed('p');
			const pTriggered = pKeyPressed && !this.settingsKeyWasPressed;
			this.settingsKeyWasPressed = pKeyPressed;
			if (pTriggered) {
				if (!this.settings.isOpen()) {
					this.settings.open();
					document.exitPointerLock();
				} else {
					this.settings.close();
					await this.engine
						.getRenderingCanvas()
						?.requestPointerLock();
				}
			}
		});
	}

	private async addPlayer() {
		const result = await BABYLON.ImportMeshAsync(models.player, this.scene);
		const model = result.meshes[0];
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
		this.mapGen.prepareRenderable(model);
		this.server.setMovementState({
			x: startX,
			y: startY,
			z: startZ,
			rotationY: 0,
			velocityY: 0,
			isGrounded: true,
		});
	}

	private boundOnClick = async () => {
		if (this.settings.isOpen()) return;
		await this.engine.getRenderingCanvas()?.requestPointerLock();
	};

	private boundOnMouseMove = (e: MouseEvent) => {
		if (this.settings.isOpen()) return;
		const canvas = this.engine.getRenderingCanvas();

		const sensitivity = 0.0025;

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
	};
}
