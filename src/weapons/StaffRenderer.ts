import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import * as COLYSEUS from '@colyseus/sdk';
import type { CombatEntity, GameState } from '../../../shared-package';
import { models } from '../assets/models';
import type { MapGenerator } from '../map/MapGenerator';

interface FireballView {
	instance: BABYLON.InstancedMesh;
	entity: CombatEntity;
	seed: number;
}

export class StaffRenderer {
	private readonly fireballs = new Map<string, FireballView>();
	private readonly pool: BABYLON.InstancedMesh[] = [];
	private readonly staffRoots = new Map<string, BABYLON.TransformNode>();
	private readonly removedPlayers = new Set<string>();
	private readonly source: BABYLON.Mesh;
	private readonly material: BABYLON.ShaderMaterial;
	private readonly observer: BABYLON.Observer<BABYLON.Scene>;
	private readonly scene: BABYLON.Scene;
	private readonly room: COLYSEUS.Room<GameState>;
	private readonly map: MapGenerator;

	constructor(
		scene: BABYLON.Scene,
		room: COLYSEUS.Room<GameState>,
		map: MapGenerator,
	) {
		this.scene = scene;
		this.room = room;
		this.map = map;
		BABYLON.Effect.ShadersStore.fireballVertexShader = `
			precision highp float;
			attribute vec3 position;
			attribute vec3 normal;
			uniform mat4 worldViewProjection;
			uniform float time;
			varying float glow;
			void main(void) {
				float noise = sin(position.x * 13.0 + time * 4.0) * sin(position.y * 11.0 - time * 3.0);
				vec3 displaced = position + normal * noise * 0.055;
				glow = noise * 0.5 + 0.5;
				gl_Position = worldViewProjection * vec4(displaced, 1.0);
			}`;
		BABYLON.Effect.ShadersStore.fireballFragmentShader = `
			precision highp float;
			varying float glow;
			void main(void) {
				vec3 core = vec3(1.0, 0.22, 0.015);
				vec3 hot = vec3(1.0, 0.88, 0.28);
				gl_FragColor = vec4(mix(core, hot, glow), 0.95);
			}`;
		this.material = new BABYLON.ShaderMaterial(
			'fireballMaterial',
			scene,
			'fireball',
			{ attributes: ['position', 'normal'], uniforms: ['worldViewProjection', 'time'] },
		);
		this.material.backFaceCulling = false;
		this.material.alphaMode = BABYLON.Constants.ALPHA_ADD;
		this.source = BABYLON.MeshBuilder.CreateIcoSphere(
			'fireballSource',
			{ radius: 0.65, subdivisions: 2 },
			scene,
		);
		this.source.material = this.material;
		this.source.isVisible = false;
		this.source.isPickable = false;
		this.observer = scene.onBeforeRenderObservable.add(() => this.animate());
	}

	listen(): void {
		const callbacks = COLYSEUS.Callbacks.get(this.room);
		callbacks.onAdd('combatEntities', (entity, id) => {
			if (entity.kind !== 'fireball') return;
			const instance = this.pool.pop() ?? this.source.createInstance(`fireball:${id}`);
			instance.isVisible = true;
			instance.isPickable = false;
			this.fireballs.set(id, { instance, entity, seed: this.hash(id) });
		});
		callbacks.onRemove('combatEntities', (_entity, id) => {
			const view = this.fireballs.get(id);
			if (!view) return;
			view.instance.isVisible = false;
			this.pool.push(view.instance);
			this.fireballs.delete(id);
		});
	}

	async attachToPlayer(playerId: string, player: BABYLON.AbstractMesh): Promise<void> {
		this.removedPlayers.delete(playerId);
		const result = await BABYLON.ImportMeshAsync(models.staff, this.scene);
		const root = new BABYLON.TransformNode(`staff:${playerId}`, this.scene);
		for (const mesh of result.meshes) {
			if (!mesh.parent) mesh.parent = root;
			this.map.prepareRenderable(mesh);
			mesh.isPickable = false;
		}
		if (this.removedPlayers.has(playerId) || player.isDisposed()) {
			root.dispose();
			return;
		}
		root.parent = player;
		root.position.set(-0.55, 0.95, 0.15);
		root.rotation.set(0, 0, Math.PI / 14);
		root.scaling.setAll(0.65);
		this.staffRoots.get(playerId)?.dispose();
		this.staffRoots.set(playerId, root);
	}

	removePlayer(playerId: string): void {
		this.removedPlayers.add(playerId);
		this.staffRoots.get(playerId)?.dispose();
		this.staffRoots.delete(playerId);
	}

	dispose(): void {
		this.scene.onBeforeRenderObservable.remove(this.observer);
		this.fireballs.forEach((view) => view.instance.dispose());
		this.pool.forEach((instance) => instance.dispose());
		this.staffRoots.forEach((root) => root.dispose());
		this.source.dispose();
		this.material.dispose();
		this.fireballs.clear();
		this.pool.length = 0;
		this.staffRoots.clear();
	}

	private animate(): void {
		const time = this.room.state.combatTimeS;
		this.material.setFloat('time', time);
		for (const view of this.fireballs.values()) {
			view.instance.position.set(view.entity.x, view.entity.y, view.entity.z);
			const pulse = 1 + Math.sin(time * 8 + view.seed * Math.PI * 2) * 0.08;
			view.instance.scaling.setAll(pulse);
		}
	}

	private hash(value: string): number {
		let hash = 2166136261;
		for (let index = 0; index < value.length; index++) {
			hash ^= value.charCodeAt(index);
			hash = Math.imul(hash, 16777619);
		}
		return (hash >>> 0) / 4294967295;
	}
}
