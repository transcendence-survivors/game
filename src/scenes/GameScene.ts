import type { Engine, Light, Scene } from '@babylonjs/core';
import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import * as COLYSEUS from 'colyseus.js';
import '@babylonjs/loaders/glTF/2.0';
import { InputManager } from '../InputManager';
import type { Vec3d } from '@transcendence/game-shared';

export class GameScene {
	private scene!: Scene;
	private engine: Engine;
	private camera!: BABYLON.FollowCamera;
	private light!: Light;
	private ground!: BABYLON.Mesh;
	private colyseusSDK!: COLYSEUS.Client;
	private uiText!: GUI.TextBlock;
	private input!: InputManager;
	private player!: BABYLON.AbstractMesh;
	private room!: GameRoom;

	private walkAnim!: BABYLON.AnimationGroup;

	constructor(engine: Engine) {
		this.engine = engine;
		this.init();
	}

	async init() {
		this.createScene();
		// this.initGUI();
		// this.connectToServer();
		await this.addPlayer();
		this.input = new InputManager(this.scene);
		this.initInput();
	}

	getScene() {
		return this.scene;
	}

	createScene() {
		this.scene = new BABYLON.Scene(this.engine);
		this.camera = new BABYLON.FollowCamera(
			'Player-Camera',
			new BABYLON.Vector3(0, 0, 0),
			this.scene,
		);
		this.camera.radius = 5;
		this.camera.heightOffset = 6;
		this.camera.rotationOffset = 180;
		this.camera.cameraAcceleration = 0.05;
		this.camera.maxCameraSpeed = 2;
		this.camera.attachControl(true);
		this.light = new BABYLON.HemisphericLight(
			'Light',
			new BABYLON.Vector3(0, 1, 0),
			this.scene,
		);
		this.light.intensity = 0.7;
		this.ground = BABYLON.MeshBuilder.CreatePlane(
			'ground',
			{ size: 30 },
			this.scene,
		);
		this.ground.position.y = 0;
		this.ground.rotation.x = Math.PI / 2;
		return this.scene;
	}

	initInput() {
		this.scene.onBeforeRenderObservable.add(() => {
			let moving = false;
			let running = false;
			if (this.input.isPressed('shift')) {
				running = true;
			}
			let speed = running ? 0.5 : 0.1;
			if (this.input.isPressed('w')) {
				this.player.translate(
					BABYLON.Axis.Z,
					speed,
					BABYLON.Space.LOCAL,
				);
				moving = true;
			}
			if (this.input.isPressed('s')) {
				this.player.translate(
					BABYLON.Axis.Z,
					-speed,
					BABYLON.Space.LOCAL,
				);
				moving = true;
			}
			if (this.input.isPressed('d')) {
				this.player.rotate(BABYLON.Axis.Y, 0.05, BABYLON.Space.LOCAL);
				moving = true;
			}
			if (this.input.isPressed('a')) {
				this.player.rotate(BABYLON.Axis.Y, -0.05, BABYLON.Space.LOCAL);
				moving = true;
			}
			if (moving) this.walkAnim.play();
			if (this.input.isReleased('shift')) {
				running = false;
			}
			if (
				this.input.isReleased('w') &&
				this.input.isReleased('s') &&
				this.input.isReleased('a') &&
				this.input.isReleased('d')
			) {
				this.walkAnim.stop();
				moving = false;
			}
		});
	}

	async addPlayer() {
		const result = await BABYLON.ImportMeshAsync(
			'/models/Player.glb',
			this.scene,
		);
		const model = result.meshes[0];
		model.position = new BABYLON.Vector3(0, 0, 0);
		model.scaling = new BABYLON.Vector3(1, 1, 1);
		model.isVisible = true;
		this.camera.lockedTarget = model;
		this.player = model;
		this.walkAnim = result.animationGroups[0];
		console.log(result);
		this.walkAnim.stop();
	}

	async connectToServer() {
		this.colyseusSDK = new COLYSEUS.Client(
			import.meta.env.VITE_GAME_SOCKET_URL,
		);

		try {
			this.room = await this.colyseusSDK.joinOrCreate('game');
			const new_pos: Vec3d = { x: 15, y: 0, z: 15 };
			this.room.send('move', new_pos);
			// this.uiText.text = 'Connected to room :' + room.roomId;
		} catch (error) {
			// this.uiText.text = 'Connection failed';
		}
	}

	initGUI() {
		const advancedTexture =
			GUI.AdvancedDynamicTexture.CreateFullscreenUI('textUI');
		this.uiText = new GUI.TextBlock('instructions');
		this.uiText.text = 'LongLiveTheKing';
		this.uiText.color = '#f0ff00';
		this.uiText.fontFamily = 'Roboto';
		this.uiText.fontSize = 24;
		GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
		this.uiText.paddingBottom = '10px';
		this.uiText.textVerticalAlignment =
			GUI.Control.VERTICAL_ALIGNMENT_CENTER;
		advancedTexture.addControl(this.uiText);
	}
}
