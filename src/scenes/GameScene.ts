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

export class GameScene {
	private scene!: Scene;
	private engine: Engine;
	private camera!: BABYLON.ArcRotateCamera;
	private input!: InputManager;
	private player!: BABYLON.AbstractMesh;
	private mapGen!: MapGenerator;
	private debugMenu!: DebugMenu;
	private light!: BABYLON.Light;

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

	private createScene() {
		this.scene = new BABYLON.Scene(this.engine);
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
			this.monsters?.update(deltaTime);
			this.camera.target.copyFrom(this.player.position);
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
