import { TerrainChunk } from './TerrainChunk';
import type { Scene, StandardMaterial, Vector3 } from '@babylonjs/core';
import type { World } from './World';

export interface ChunkManagerOptions {
	/** Rayon (en chunks) chargé autour du joueur. */
	viewDistance: number;
	/** Rendu facetté (flat shading) façon Megabonk. */
	flat: boolean;
}

/**
 * Charge / décharge les chunks de terrain autour du joueur, avec un budget de
 * construction par frame pour lisser le coût. Portage du `ChunkManager` de
 * `data.html`.
 */
export class ChunkManager {
	private scene: Scene;
	private world: World;
	private mat: StandardMaterial;
	private size: number;
	private view: number;
	private flat: boolean;
	private chunks = new Map<string, TerrainChunk>();
	private queue: Array<[number, number, string]> = [];
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
	}

	update(p: Vector3): void {
		const cx = Math.floor(p.x / this.size);
		const cz = Math.floor(p.z / this.size);
		const key = `${cx},${cz}`;
		if (key !== this.lastCell) {
			this.lastCell = key;
			for (let dz = -this.view; dz <= this.view; dz++)
				for (let dx = -this.view; dx <= this.view; dx++) {
					const k = `${cx + dx},${cz + dz}`;
					if (!this.chunks.has(k)) this.queue.push([cx + dx, cz + dz, k]);
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
		while (budget-- > 0 && this.queue.length) {
			const next = this.queue.shift();
			if (!next) break;
			const [x, z, k] = next;
			if (this.chunks.has(k)) continue;
			this.chunks.set(
				k,
				new TerrainChunk(this.scene, this.world, x, z, this.mat, this.flat),
			);
		}
	}

	clear(): void {
		for (const c of this.chunks.values()) c.dispose();
		this.chunks.clear();
		this.queue.length = 0;
		this.lastCell = null;
	}

	dispose(): void {
		this.clear();
	}
}
