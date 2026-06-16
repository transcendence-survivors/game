import type { Engine, Light, Scene } from '@babylonjs/core';
import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import * as COLYSEUS from 'colyseus.js';
import networkSettings from '../data/network.json';

export class GameScene {
	private scene!: Scene;
	private engine: Engine;
	private camera!: BABYLON.ArcRotateCamera; // Subject to change
	private light!: Light;
	private ground!: BABYLON.Mesh;
	private colyseusSDK!: COLYSEUS.Client;
	private uiText!: GUI.TextBlock;

	constructor(engine: Engine) {
		this.engine = engine;
		this.init();
	}

	init() {
		this.createScene();
		this.initGUI();
		// this.connectToServer();
		this.addPlayer();
	}

	getScene() {
		return this.scene;
	}

	createScene() {
		this.scene = new BABYLON.Scene(this.engine);
		this.camera = new BABYLON.ArcRotateCamera(
			'Camera',
			Math.PI / 2,
			1.0,
			550,
			BABYLON.Vector3.Zero(),
			this.scene,
		);
		this.camera.setTarget(BABYLON.Vector3.Zero());
		this.light = new BABYLON.HemisphericLight(
			'Light',
			new BABYLON.Vector3(0, 1, 0),
			this.scene,
		);
		this.light.intensity = 0.7;
		this.ground = BABYLON.MeshBuilder.CreatePlane(
			'ground',
			{ size: 500 },
			this.scene,
		);
		this.ground.position.y = -15;
		this.ground.rotation.x = Math.PI / 2;
		return this.scene;
	}

	async addPlayer() {
		const player = await BABYLON.ImportMeshAsync(
			'/models/bomb.glb',
			this.scene,
		);
		console.log(player);
	}

	async connectToServer() {
		console.log(import.meta.env);
		this.colyseusSDK = new COLYSEUS.Client(
			import.meta.env.VITE_GAME_SOCKET_URL,
		);

		try {
			const room = await this.colyseusSDK.joinOrCreate('my_room');
			this.uiText.text = 'Connected to room :' + room.roomId;
		} catch (error) {
			this.uiText.text = 'Connection failed';
		}
	}

	initGUI() {
		const advancedTexture =
			GUI.AdvancedDynamicTexture.CreateFullscreenUI('textUI');
		this.uiText = new GUI.TextBlock('instructions');
		this.uiText.text = 'Je deteste Benoit Cabocel';
		this.uiText.color = '#f0ff00';
		this.uiText.fontFamily = 'Roboto';
		this.uiText.fontSize = 48;
		this.uiText.textHorizontalAlignment =
			GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
		this.uiText.paddingBottom = '10px';
		this.uiText.textVerticalAlignment =
			GUI.Control.VERTICAL_ALIGNMENT_CENTER;
		advancedTexture.addControl(this.uiText);
	}
}
