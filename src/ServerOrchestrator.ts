import * as BABYLON from '@babylonjs/core';
import * as COLYSEUS from '@colyseus/sdk';
import { MapGenerator } from './map/MapGenerator';
import type { AuraInstance } from './map/effects/PlayerAuraPlugin';
import {
	applyHorizontalMovement,
	applyVerticalMovement,
	resolveTerrainCollision,
	type GameState,
	type MoveInput,
	type MovementState,
} from '../../shared-package/src';

import { models } from './assets/models';
import { SceneManager } from './SceneManager';

export class ServerOrchestrator {
	private colyseusSDK!: COLYSEUS.Client;
	private scene!: BABYLON.Scene;
	private remoteTargets: Map<
		string,
		{ x: number; z: number; y: number; rotationY: number }
	> = new Map();
	private remotePlayers: Map<string, BABYLON.AbstractMesh> = new Map();
	private remotePlayerAnims: Map<string, BABYLON.AnimationGroup> = new Map();
	private removedWhileLoading = new Set<string>();
	private mapGen!: MapGenerator;
	private room!: COLYSEUS.Room<GameState>;
	private player!: BABYLON.AbstractMesh;
	private pendingInputs: MoveInput[] = [];
	private movementState: MovementState = {
		x: 0,
		y: 0,
		z: 0,
		rotationY: 0,
		velocityY: 0,
		isGrounded: true,
	};

	constructor(scene: BABYLON.Scene, room: COLYSEUS.Room<GameState>) {
		this.scene = scene;
		this.room = room;
	}

	async init() {
		await this.connect();
	}

	setPlayer(player: BABYLON.AbstractMesh) {
		this.player = player;
	}

	pushPendingInput(input: MoveInput) {
		this.pendingInputs.push(input);
	}

	getMovementState() {
		return this.movementState;
	}

	setMovementState(state: MovementState) {
		this.movementState = state;
	}

	send(message: string, input: MoveInput) {
		this.room.send(message, input);
	}

	async addRemotePlayer(sessionId: string) {
		const result = await BABYLON.ImportMeshAsync(models.player, this.scene);
		const model = result.meshes[0];
		if (this.removedWhileLoading.delete(sessionId)) {
			result.animationGroups.forEach((animation) => animation.dispose());
			model.dispose();
			return null;
		}
		model.rotationQuaternion = null;
		this.remotePlayers.set(sessionId, model);
		result.animationGroups[0].stop();
		this.remotePlayerAnims.set(sessionId, result.animationGroups[0]);
		this.mapGen.addShadowCaster(model);
		return model;
	}

	updateRemotePlayers(deltaTime: number) {
		const lerpFactor = Math.min(1, deltaTime * 10);
		for (const [sessionId, mesh] of this.remotePlayers) {
			const target = this.remoteTargets.get(sessionId);
			if (!target) continue;
			const targetPos = new BABYLON.Vector3(target.x, target.y, target.z);
			const newPos = BABYLON.Vector3.Lerp(
				mesh.position,
				targetPos,
				lerpFactor,
			);
			mesh.position.copyFrom(newPos);
			const targetRotation = target.rotationY + Math.PI;
			mesh.rotation.y = BABYLON.Scalar.LerpAngle(
				mesh.rotation.y,
				targetRotation,
				lerpFactor,
			);
		}
	}

	removeRemotePlayer(sessionId: string) {
		const mesh = this.remotePlayers.get(sessionId);
		if (mesh) {
			mesh.dispose();
			this.remotePlayers.delete(sessionId);
		} else {
			this.removedWhileLoading.add(sessionId);
		}
		this.remoteTargets.delete(sessionId);
		this.remotePlayerAnims.get(sessionId)?.dispose();
		this.remotePlayerAnims.delete(sessionId);
	}

	async connect() {
		try {
			await new Promise<void>((resolve) => {
				this.room.onMessage(
					'worldSeed',
					({ seed }: { seed: number }) => {
						this.mapGen = new MapGenerator(this.scene, seed);
						resolve();
					},
				);
			});
			this.room.onMessage('gameOver', (player) => {
				document.exitPointerLock();
				SceneManager.toLobby();
			});
		} catch (error) {
			console.log(error);
		}
	}

	getMapGen() {
		return this.mapGen;
	}

	getRoom() {
		return this.room;
	}

	collectAuras(): AuraInstance[] {
		const out: AuraInstance[] = [];
		const players = this.room.state?.players;
		if (!players) return out;
		players.forEach((player, sessionId) => {
			const aura = player.aura;
			if (!aura || aura.radius <= 0) return;
			let x = player.x;
			let z = player.z;
			if (sessionId === this.room.sessionId) {
				if (this.player) {
					x = this.player.position.x;
					z = this.player.position.z;
				}
			} else {
				const mesh = this.remotePlayers.get(sessionId);
				if (mesh) {
					x = mesh.position.x;
					z = mesh.position.z;
				}
			}
			out.push({
				x,
				z,
				radius: aura.radius,
				attackSpeed: aura.attackSpeed,
			});
		});
		return out;
	}

	getLocalSpawn(): { x: number; y: number; z: number } | null {
		const player = this.room.state?.players?.get(this.room.sessionId);
		if (
			!player ||
			typeof player.x !== 'number' ||
			typeof player.y !== 'number' ||
			typeof player.z !== 'number'
		)
			return null;
		return { x: player.x, y: player.y, z: player.z };
	}

	reconcile(serverState: {
		x?: number;
		z?: number;
		y?: number;
		rotationY?: number;
		velocityY?: number;
		isGrounded?: boolean;
		lastProcessedSeq?: number;
	}) {
		if (!this.player) return;
		if (
			typeof serverState.x !== 'number' ||
			typeof serverState.y !== 'number' ||
			typeof serverState.z !== 'number' ||
			typeof serverState.rotationY !== 'number' ||
			typeof serverState.velocityY !== 'number' ||
			typeof serverState.isGrounded !== 'boolean' ||
			typeof serverState.lastProcessedSeq !== 'number'
		)
			return;
		this.pendingInputs = this.pendingInputs.filter(
			(input) => input.seq > serverState.lastProcessedSeq!,
		);

		let state: MovementState = {
			x: serverState.x,
			y: serverState.y,
			z: serverState.z,
			rotationY: serverState.rotationY,
			velocityY: serverState.velocityY,
			isGrounded: serverState.isGrounded,
		};

		const world = this.mapGen.getWorld();

		for (const input of this.pendingInputs) {
			const player = this.room.state.players.get(this.room.sessionId);
			if (!player) return;
			const horizontalMove = applyHorizontalMovement(
				state,
				input,
				input.cameraYaw,
				player.stats.moveSpeed,
			);
			const resolved = resolveTerrainCollision(
				world,
				state,
				horizontalMove,
				state.y,
			);
			const groundHeight = world.height(resolved.x, resolved.z);
			const verticalMove = applyVerticalMovement(
				state.y,
				state.velocityY,
				state.isGrounded,
				groundHeight,
				input,
			);
			state = {
				x: resolved.x,
				z: resolved.z,
				y: verticalMove.y,
				rotationY: horizontalMove.rotationY,
				velocityY: verticalMove.velocityY,
				isGrounded: verticalMove.isGrounded,
			};
		}
		this.movementState = state;
		this.player.position.x = state.x;
		this.player.position.y = state.y;
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
				if (!mesh) return;
				this.remoteTargets.set(sessionId, {
					x: player.x,
					rotationY: player.rotationY,
					z: player.z,
					y: player.y,
				});
				mesh.position.x = player.x;
				mesh.position.z = player.z;
				mesh.position.y = this.mapGen.getGroundHeight(
					player.x,
					player.z,
				);
				mesh.rotation.y = player.rotationY + Math.PI;
				callbacks.onChange(player, () => {
					this.remoteTargets.set(sessionId, {
						x: player.x,
						z: player.z,
						rotationY: player.rotationY,
						y: player.y,
					});
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

	dispose() {
		this.remotePlayers.forEach((mesh) => mesh.dispose());
		this.remotePlayerAnims.forEach((animation) => animation.dispose());
		this.remotePlayers.clear();
		this.remotePlayerAnims.clear();
		this.remoteTargets.clear();
		this.removedWhileLoading.clear();
		this.pendingInputs = [];
	}
}
