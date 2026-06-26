import type { Engine, Scene } from '@babylonjs/core';
import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import * as COLYSEUS from '@colyseus/sdk';
import '@babylonjs/loaders/glTF/2.0';
import { InputManager } from '../InputManager';
import {
	applyMovement,
	type MoveInput,
	type MovementState,
} from '../../../shared-package';
import type { GameState } from '@transcendence/game-shared';
import { MapGenerator } from '../MapGenerator';

const FORWARD_KEY = 'w';
const BACKWARD_KEY = 's';
const LEFT_KEY = 'a';
const RIGHT_KEY = 'd';

export class GameScene {
	private scene!: Scene;
	private engine: Engine;
	private camera!: BABYLON.FollowCamera;
	private light!: BABYLON.Light;
	private colyseusSDK!: COLYSEUS.Client;
	private input!: InputManager;
	private player!: BABYLON.AbstractMesh;
	private room!: COLYSEUS.Room<GameState>;
	private mapGen!: MapGenerator;

	private remotePlayers: Map<string, BABYLON.AbstractMesh> = new Map();
	private remotePlayerAnims: Map<string, BABYLON.AnimationGroup> = new Map();

	private walkAnim!: BABYLON.AnimationGroup;

	public ready: Promise<void>;

	private pendingInputs: MoveInput[] = [];
	private seq = 0;

	constructor(engine: Engine) {
		this.engine = engine;
		this.ready = this.init();
	}

	private async init() {
		try {
			this.createScene();
			this.initGUI();
			await this.connectToServer();
			await this.addPlayer();
			this.input = new InputManager(this.scene);
			this.initInput();
			this.listenToState();
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

	createScene() {
		this.scene = new BABYLON.Scene(this.engine);
		this.camera = new BABYLON.FollowCamera(
			'Player-Camera',
			new BABYLON.Vector3(0, 10, -10),
			this.scene,
		);
		this.camera.radius = 5;
		this.camera.heightOffset = 5;
		this.camera.rotationOffset = 180;
		this.camera.cameraAcceleration = 0.05;
		this.camera.maxCameraSpeed = 2;
		this.camera.attachControl(true);
		this.light = new BABYLON.HemisphericLight(
			'Light',
			new BABYLON.Vector3(0, 1, 0),
			this.scene,
		);
		this.light.intensity = 0.5;
		// this.ground = BABYLON.MeshBuilder.CreateGround(
		// 	'ground',
		// 	{ width: 30, height: 30 },
		// 	this.scene,
		// );
		// this.ground.position.y = 0;
		// this.ground.rotation.x = 0;
		this.mapGen = new MapGenerator(this.scene);
		return this.scene;
	}

	initInput() {
		let lastTime = performance.now();
		// let sendAccumulator = 0;
		// const SEND_RATE = 1 / 20;
		this.scene.onBeforeRenderObservable.add(() => {
			const now = performance.now();
			const deltaTime = (now - lastTime) / 1000;
			lastTime = now;
			// sendAccumulator += deltaTime;
			const input: MoveInput = {
				seq: ++this.seq,
				forward: this.input.isPressed(FORWARD_KEY),
				backward: this.input.isPressed(BACKWARD_KEY),
				right: this.input.isPressed(RIGHT_KEY),
				left: this.input.isPressed(LEFT_KEY),
				deltaTime,
			};
			const moving =
				input.forward || input.backward || input.right || input.left;
			moving ? this.walkAnim.play() : this.walkAnim.stop();
			const currentState: MovementState = {
				x: this.player.position.x,
				z: this.player.position.z,
				rotationY: this.player.rotation.y,
			};
			const newState = applyMovement(currentState, input);
			this.player.position.x = newState.x;
			this.player.position.z = newState.z;
			this.player.rotation.y = newState.rotationY;
			this.pendingInputs.push(input);
			// if (sendAccumulator >= SEND_RATE) {
			// 	if (this.room) this.room.send('move', input);
			// 	sendAccumulator = 0;
			// }
			this.room.send('move', input);
			this.mapGen.update(deltaTime, this.player);
		});
	}

	async addPlayer() {
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

	async addRemotePlayer(sessionId: string) {
		const result = await BABYLON.ImportMeshAsync(
			'/models/Player.glb',
			this.scene,
		);
		const model = result.meshes[0];
		model.rotationQuaternion = null;
		this.remotePlayers.set(sessionId, model);
		result.animationGroups[0].stop();
		this.mapGen.addShadowCaster(model);
		return model;
	}

	removeRemotePlayer(sessionId: string) {
		const mesh = this.remotePlayers.get(sessionId);
		if (mesh) {
			mesh.dispose();
			this.remotePlayers.delete(sessionId);
		}
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

	reconcile(serverState: {
		x?: number;
		z?: number;
		rotationY?: number;
		lastProcessedSeq?: number;
	}) {
		if (!this.player) return;
		if (
			typeof serverState.x !== 'number' ||
			typeof serverState.z !== 'number' ||
			typeof serverState.rotationY !== 'number' ||
			typeof serverState.lastProcessedSeq !== 'number'
		)
			return;
		this.pendingInputs = this.pendingInputs.filter(
			(input) => input.seq > serverState.lastProcessedSeq!,
		);

		let state: MovementState = {
			x: serverState.x,
			z: serverState.z,
			rotationY: serverState.rotationY,
		};

		for (const input of this.pendingInputs) {
			state = applyMovement(state, input);
		}

		this.player.position.x = state.x;
		this.player.position.z = state.z;
		this.player.rotation.y = state.rotationY;
	}

	listenToState() {
		const callbacks = COLYSEUS.Callbacks.get(this.room);
		callbacks.onAdd('players', async (player, sessionId) => {
			if (sessionId === this.room.sessionId) {
				if (!this.player) return;
				this.reconcile(player);
				callbacks.onChange(player, () => {
					if (!this.player) return;
					this.reconcile(player);
				});
			} else {
				const mesh = await this.addRemotePlayer(sessionId);
				callbacks.onChange(player, () => {
					mesh.position.x = player.x;
					mesh.position.z = player.z;
					mesh.rotation.y = player.rotationY + Math.PI;
					const anim = this.remotePlayerAnims.get(sessionId);
					if (anim) {
						if (player.animState === 'moving') anim.play(true);
						else anim.stop();
					}
				});
			}
		});
		callbacks.onRemove('players', (player, sessionId) => {
			if (sessionId !== this.room.sessionId) {
				this.removeRemotePlayer(sessionId);
			}
		});
	}
}
