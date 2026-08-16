import * as BABYLON from '@babylonjs/core';
import * as COLYSEUS from '@colyseus/sdk';
import { MapGenerator } from './map/MapGenerator';
import type { AuraInstance } from './map/effects/PlayerAuraPlugin';
import {
	simulatePlayerMovement,
	type GameState,
	type MoveInput,
	type MovementState,
	ClientMessage,
	ServerMessage,
	type WorldSeedMessage,
} from '@transcendence/game-shared';

import type { ModelAssetLibrary } from './assets/ModelAssetLibrary';
import { models } from './assets/models';
import { SceneManager } from './SceneManager';
import { CombatRenderer } from './combat/CombatRenderer';
import { CombatAssetLibrary } from './combat/CombatAssetLibrary';
import { WeaponAttachmentRenderer } from './combat/WeaponAttachmentRenderer';
import { AsyncViewRegistry } from './combat/AsyncViewRegistry';

class RemotePlayerView {
	readonly mesh: BABYLON.AbstractMesh;
	readonly animation: BABYLON.AnimationGroup;

	constructor(
		mesh: BABYLON.AbstractMesh,
		animation: BABYLON.AnimationGroup,
	) {
		this.mesh = mesh;
		this.animation = animation;
	}

	dispose(): void {
		this.animation.dispose();
		this.mesh.dispose();
	}
}

export class ServerOrchestrator {
	private scene!: BABYLON.Scene;
	private remoteTargets: Map<
		string,
		{ x: number; z: number; y: number; rotationY: number }
	> = new Map();
	private remotePlayers = new AsyncViewRegistry<RemotePlayerView>();
	private mapGen!: MapGenerator;
	private room!: COLYSEUS.Room<GameState>;
	private player!: BABYLON.AbstractMesh;
	private combatRenderer!: CombatRenderer;
	private weaponAttachments!: WeaponAttachmentRenderer;
	private combatAssets!: CombatAssetLibrary;
	private pendingInputs: MoveInput[] = [];
	private readonly playerAssets: ModelAssetLibrary;
	private combatHitboxesVisible = false;
	private movementState: MovementState = {
		x: 0,
		y: 0,
		z: 0,
		rotationY: 0,
		velocityY: 0,
		isGrounded: true,
	};

	constructor(
		scene: BABYLON.Scene,
		room: COLYSEUS.Room<GameState>,
		playerAssets: ModelAssetLibrary,
	) {
		this.scene = scene;
		this.room = room;
		this.playerAssets = playerAssets;
	}

	async init() {
		await this.connect();
	}

	setPlayer(player: BABYLON.AbstractMesh) {
		this.player = player;
		this.weaponAttachments.attachToPlayer(this.room.sessionId, player);
	}

	pushPendingInput(input: MoveInput) {
		this.pendingInputs.push(input);
	}

	setCombatHitboxesVisible(visible: boolean) {
		this.combatHitboxesVisible = visible;
		this.combatRenderer?.setHitboxesVisible(visible);
	}

	setDebugImmortal(enabled: boolean) {
		this.room.send(ClientMessage.SetDebugImmortal, { enabled });
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
		await this.remotePlayers.add(sessionId, async () => {
			const result = await this.playerAssets.instantiate(
				models.player,
				`remotePlayer:${sessionId}`,
			);
			const model = result.root;
			const animation = result.animationGroups[0];
			model.rotationQuaternion = null;
			animation.stop();
			this.mapGen.prepareRenderable(model);
			return new RemotePlayerView(model, animation);
		});
		const view = this.remotePlayers.get(sessionId);
		if (!view) return null;
		this.weaponAttachments.attachToPlayer(sessionId, view.mesh);
		return view.mesh;
	}

	updateRemotePlayers(deltaTime: number) {
		const lerpFactor = Math.min(1, deltaTime * 10);
		this.remotePlayers.forEach(({ mesh }, sessionId) => {
			const target = this.remoteTargets.get(sessionId);
			if (!target) return;
			mesh.position.x = BABYLON.Scalar.Lerp(
				mesh.position.x,
				target.x,
				lerpFactor,
			);
			mesh.position.y = BABYLON.Scalar.Lerp(
				mesh.position.y,
				target.y,
				lerpFactor,
			);
			mesh.position.z = BABYLON.Scalar.Lerp(
				mesh.position.z,
				target.z,
				lerpFactor,
			);
			const targetRotation = target.rotationY + Math.PI;
			mesh.rotation.y = BABYLON.Scalar.LerpAngle(
				mesh.rotation.y,
				targetRotation,
				lerpFactor,
			);
		});
	}

	removeRemotePlayer(sessionId: string) {
		this.weaponAttachments.removePlayer(sessionId);
		this.remotePlayers.remove(sessionId);
		this.remoteTargets.delete(sessionId);
	}

	async connect() {
		try {
			await new Promise<void>((resolve) => {
				this.room.onMessage(
					ServerMessage.WorldSeed,
					({ seed }: WorldSeedMessage) => {
						this.mapGen = new MapGenerator(this.scene, seed);
						this.combatAssets = new CombatAssetLibrary(
							this.scene,
							this.mapGen,
						);
						this.weaponAttachments = new WeaponAttachmentRenderer(
							this.combatAssets,
						);
						this.combatRenderer = new CombatRenderer(
							this.scene,
							this.room,
							this.combatAssets,
							this.weaponAttachments,
						);
						this.combatRenderer.listen();
						this.combatRenderer.setHitboxesVisible(
							this.combatHitboxesVisible,
						);
						resolve();
					},
				);
			});
			this.room.onMessage(ServerMessage.GameOver, () => {
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
				const view = this.remotePlayers.get(sessionId);
				if (view) {
					x = view.mesh.position.x;
					z = view.mesh.position.z;
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
		let acknowledged = 0;
		while (
			this.pendingInputs[acknowledged]?.seq <= serverState.lastProcessedSeq
		)
			acknowledged++;
		if (acknowledged) this.pendingInputs.splice(0, acknowledged);

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
			state = simulatePlayerMovement(
				world,
				state,
				input,
				player.stats.moveSpeed,
			);
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
				callbacks.onAdd(player, 'weapons', (weapon) => {
					if (!this.player) return;
					this.weaponAttachments.attachWeapon(
						sessionId,
						this.player,
						weapon.kind,
					);
				});
				this.reconcile(player);
				callbacks.onChange(player, () => {
					if (!this.player) return;
					this.reconcile(player);
				});
			} else {
				const mesh = await this.addRemotePlayer(sessionId);
				if (!mesh) return;
				callbacks.onAdd(player, 'weapons', (weapon) => {
					this.weaponAttachments.attachWeapon(
						sessionId,
						mesh,
						weapon.kind,
					);
				});
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
					const view = this.remotePlayers.get(sessionId);
					if (view) {
						if (player.animState === 'moving')
							view.animation.play(true);
						else view.animation.stop();
					}
				});
			}
		});
		callbacks.onRemove('players', (_player, sessionId) => {
			if (sessionId !== this.room.sessionId) {
				this.removeRemotePlayer(sessionId);
			}
		});
	}

	dispose() {
		this.combatRenderer?.dispose();
		this.weaponAttachments?.dispose();
		this.combatAssets?.dispose();
		this.remotePlayers.dispose();
		this.remoteTargets.clear();
		this.pendingInputs = [];
	}
}
