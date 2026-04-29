export class TerrainGenerator {
	private readonly _tileSize: number;

	constructor(tileSize: number) {
		this._tileSize = tileSize;
	}

	get tileSize(): number {
		return this._tileSize;
	}

	getVoxelHeight(gridX: number, gridZ: number): number {
		let h = Math.sin(gridX * 0.03) * Math.cos(gridZ * 0.03) * 12;
		h += Math.sin(gridX * 0.08 + 1.0) * Math.cos(gridZ * 0.08 + 2.0) * 4;
		h += Math.sin(gridX * 0.2 + 3.0) * Math.cos(gridZ * 0.2 + 4.0) * 1.5;
		return Math.round(h);
	}

	getHeightAt(worldX: number, worldZ: number): number {
		const gridX = Math.round(worldX / this._tileSize);
		const gridZ = Math.round(worldZ / this._tileSize);
		return this.getVoxelHeight(gridX, gridZ) * this._tileSize;
	}

	getMaxHeightAround(worldX: number, worldZ: number, radius: number): number {
		const h1 = this.getHeightAt(worldX + radius, worldZ + radius);
		const h2 = this.getHeightAt(worldX - radius, worldZ + radius);
		const h3 = this.getHeightAt(worldX + radius, worldZ - radius);
		const h4 = this.getHeightAt(worldX - radius, worldZ - radius);
		return Math.max(h1, h2, h3, h4);
	}
}
