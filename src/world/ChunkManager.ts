import {
	Color3, Matrix, Mesh, MeshBuilder, Scene, StandardMaterial,
} from '@babylonjs/core';
import type { TerrainGenerator } from './TerrainGenerator';

export interface ChunkManagerConfig {
	chunkSize: number;
	viewDistance: number;
}

export class ChunkManager {
	private readonly _scene: Scene;
	private readonly _terrain: TerrainGenerator;
	private readonly _config: ChunkManagerConfig;
	private readonly _baseMaterial: StandardMaterial;
	private readonly _activeChunks: Map<string, Mesh> = new Map();

	constructor(scene: Scene, terrain: TerrainGenerator, config: ChunkManagerConfig) {
		this._scene = scene;
		this._terrain = terrain;
		this._config = config;

		this._baseMaterial = new StandardMaterial('chunkMat', scene);
		this._baseMaterial.diffuseColor = new Color3(1, 1, 1);
		this._baseMaterial.specularColor = new Color3(0, 0, 0);
	}

	async preGenerate(
		playerWorldX: number,
		playerWorldZ: number,
		viewDistance: number,
		onChunkBuilt?: () => void,
	): Promise<void> {
		const tileSize = this._terrain.tileSize;
		const playerGridX = Math.round(playerWorldX / tileSize);
		const playerGridZ = Math.round(playerWorldZ / tileSize);
		const currentChunkX = Math.floor(playerGridX / this._config.chunkSize);
		const currentChunkZ = Math.floor(playerGridZ / this._config.chunkSize);

		for (let x = -viewDistance; x <= viewDistance; x++) {
			for (let z = -viewDistance; z <= viewDistance; z++) {
				const cx = currentChunkX + x;
				const cz = currentChunkZ + z;
				const key = `${cx}_${cz}`;
				if (!this._activeChunks.has(key)) {
					this._buildChunk(cx, cz);
					onChunkBuilt?.();
					await new Promise(resolve => setTimeout(resolve, 0));
				}
			}
		}
	}

	update(playerWorldX: number, playerWorldZ: number): void {
		const tileSize = this._terrain.tileSize;
		const playerGridX = Math.round(playerWorldX / tileSize);
		const playerGridZ = Math.round(playerWorldZ / tileSize);

		const currentChunkX = Math.floor(playerGridX / this._config.chunkSize);
		const currentChunkZ = Math.floor(playerGridZ / this._config.chunkSize);

		const toKeep = new Set<string>();
		const view = this._config.viewDistance;

		for (let x = -view; x <= view; x++) {
			for (let z = -view; z <= view; z++) {
				const cx = currentChunkX + x;
				const cz = currentChunkZ + z;
				const key = `${cx}_${cz}`;
				toKeep.add(key);
				if (!this._activeChunks.has(key)) {
					this._buildChunk(cx, cz);
				}
			}
		}

		for (const [key, mesh] of this._activeChunks.entries()) {
			if (!toKeep.has(key)) {
				mesh.dispose();
				this._activeChunks.delete(key);
			}
		}
	}

	private _buildChunk(chunkX: number, chunkZ: number): void {
		const tileSize = this._terrain.tileSize;
		const chunkSize = this._config.chunkSize;
		const chunkKey = `${chunkX}_${chunkZ}`;

		const baseBox = MeshBuilder.CreateBox(chunkKey, { size: tileSize }, this._scene);
		baseBox.material = this._baseMaterial;
		baseBox.freezeWorldMatrix();
		baseBox.doNotSyncBoundingInfo = true;

		const startX = chunkX * chunkSize;
		const startZ = chunkZ * chunkSize;
		const endX = startX + chunkSize;
		const endZ = startZ + chunkSize;

		const instanceCount = chunkSize * chunkSize;
		const matricesData = new Float32Array(instanceCount * 16);
		const colorsData = new Float32Array(instanceCount * 4);

		let index = 0;
		for (let x = startX; x < endX; x++) {
			for (let z = startZ; z < endZ; z++) {
				const discreteHeight = this._terrain.getVoxelHeight(x, z);
				const posX = x * tileSize;
				const posZ = z * tileSize;
				const posY = discreteHeight * tileSize;

				Matrix.Translation(posX, posY, posZ).copyToArray(matricesData, index * 16);

				const color = this._colorForHeight(discreteHeight);
				colorsData[index * 4] = color.r;
				colorsData[index * 4 + 1] = color.g;
				colorsData[index * 4 + 2] = color.b;
				colorsData[index * 4 + 3] = 1.0;
				index++;
			}
		}

		baseBox.thinInstanceSetBuffer('matrix', matricesData, 16);
		baseBox.thinInstanceSetBuffer('color', colorsData, 4);
		baseBox.thinInstanceRefreshBoundingInfo();
		this._activeChunks.set(chunkKey, baseBox);
	}

	private _colorForHeight(h: number): { r: number; g: number; b: number } {
		if (h < -4) return { r: 0.8, g: 0.7, b: 0.4 };
		if (h < 2) return { r: 0.3, g: 0.6, b: 0.3 };
		if (h < 8) return { r: 0.2, g: 0.4, b: 0.2 };
		if (h < 13) return { r: 0.5, g: 0.5, b: 0.5 };
		return { r: 0.9, g: 0.9, b: 0.9 };
	}
}
