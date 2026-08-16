import { TerrainChunk } from './TerrainChunk';
import type { Mesh, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';
import type { World } from '@transcendence/game-shared';

export interface ChunkManagerOptions {
	viewDistance: number;
	flat: boolean;
	onChunk?: (mesh: Mesh) => void;
}
export class ChunkManager {
	private scene: Scene;
	private world: World;
	private mat: StandardMaterial;
	private size: number;
	private view: number;
	private flat: boolean;
	private onChunk?: (mesh: Mesh) => void;
	private chunks = new Map<string, TerrainChunk>();
	private queue: Array<[number, number, string]> = [];
	private queueIndex = 0;
	private lastCell: string | null = null;

	constructor(
		scene: Scene,
		world: World,
		mat: StandardMaterial,
		opt: ChunkManagerOptions,
	) {
		this.scene = scene;
		this.world = world;
		this.mat = mat;
		this.size = world.N * world.CELL;
		this.view = opt.viewDistance;
		this.flat = opt.flat;
		this.onChunk = opt.onChunk;
	}

	update(p: Vector3): void {
		const cx = Math.floor(p.x / this.size);
		const cz = Math.floor(p.z / this.size);
		const key = `${cx},${cz}`;
		if (key !== this.lastCell) {
			this.lastCell = key;
			this.queue = [];
			this.queueIndex = 0;
			for (let dz = -this.view; dz <= this.view; dz++)
				for (let dx = -this.view; dx <= this.view; dx++) {
					const k = `${cx + dx},${cz + dz}`;
					if (!this.chunks.has(k))
						this.queue.push([cx + dx, cz + dz, k]);
				}
			for (const [k, c] of this.chunks) {
				const a = k.split(',');
				if (
					Math.abs(+a[0] - cx) > this.view + 1 ||
					Math.abs(+a[1] - cz) > this.view + 1
				) {
					c.dispose();
					this.chunks.delete(k);
				}
			}
		}
		let budget = 2;
		while (budget-- > 0 && this.queueIndex < this.queue.length) {
			const next = this.queue[this.queueIndex++];
			const [x, z, k] = next;
			if (this.chunks.has(k)) continue;
			const chunk = new TerrainChunk(
				this.scene,
				this.world,
				x,
				z,
				this.mat,
				this.flat,
			);
			this.chunks.set(k, chunk);
			this.onChunk?.(chunk.mesh);
		}
		if (this.queueIndex === this.queue.length) {
			this.queue = [];
			this.queueIndex = 0;
		}
	}

	clear(): void {
		for (const c of this.chunks.values()) c.dispose();
		this.chunks.clear();
		this.queue.length = 0;
		this.queueIndex = 0;
		this.lastCell = null;
	}

	dispose(): void {
		this.clear();
	}
}
