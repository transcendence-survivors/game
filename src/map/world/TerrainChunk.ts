import { Mesh, VertexData } from '@babylonjs/core';
import type { Scene, StandardMaterial } from '@babylonjs/core';
import type {
	World,
	WorldColor,
} from '../../../../shared-package/src/world/World';

/** Sommet : position (x, y, z) + couleur. */
type Vtx = readonly [number, number, number, WorldColor];

function dark(c: WorldColor, k: number): WorldColor {
	return { r: c.r * k, g: c.g * k, b: c.b * k };
}

// Pentes / falaises = terre.
const DIRT: WorldColor = { r: 0.4, g: 0.29, b: 0.19 };
const DIRT_DARK = dark(DIRT, 0.7);

// Arêtes d'une cellule : normale (nx, nz) + 2 extrémités (en unités de CELL).
// Sert aux murs (falaises) ET aux faces latérales de rampe.
const EDGES: ReadonlyArray<
	readonly [number, number, number, number, number, number]
> = [
	[0, -1, 0, 0, 1, 0],
	[0, 1, 0, 1, 1, 1],
	[-1, 0, 0, 0, 0, 1],
	[1, 0, 1, 0, 1, 1],
];

/**
 * Construit le mesh d'un chunk : falaises (murs de terre d'un palier), plateaux
 * d'herbe et pentes d'herbe. Le winding est auto-corrigé via la normale visée.
 */
export function buildChunkMesh(
	scene: Scene,
	world: World,
	chunkX: number,
	chunkZ: number,
	mat: StandardMaterial,
	flat: boolean,
): Mesh {
	const CELL = world.CELL;
	const N = world.N;
	const STEP = world.STEP;
	const pos: number[] = [];
	const idx: number[] = [];
	const col: number[] = [];

	const vtx = (p: Vtx): number => {
		const i = pos.length / 3;
		pos.push(p[0], p[1], p[2]);
		const c = p[3];
		col.push(c.r, c.g, c.b, 1);
		return i;
	};
	const tri = (
		p1: Vtx,
		p2: Vtx,
		p3: Vtx,
		nx: number,
		ny: number,
		nz: number,
	): void => {
		const ax = p2[0] - p1[0];
		const ay = p2[1] - p1[1];
		const az = p2[2] - p1[2];
		const bx = p3[0] - p1[0];
		const by = p3[1] - p1[1];
		const bz = p3[2] - p1[2];
		const cx = by * az - bz * ay;
		const cy = bz * ax - bx * az;
		const cz = bx * ay - by * ax;
		if (cx * nx + cy * ny + cz * nz >= 0)
			idx.push(vtx(p1), vtx(p2), vtx(p3));
		else idx.push(vtx(p1), vtx(p3), vtx(p2));
	};
	const quad = (
		p1: Vtx,
		p2: Vtx,
		p3: Vtx,
		p4: Vtx,
		nx: number,
		ny: number,
		nz: number,
	): void => {
		tri(p1, p2, p3, nx, ny, nz);
		tri(p1, p3, p4, nx, ny, nz);
	};

	for (let j = 0; j < N; j++) {
		for (let i = 0; i < N; i++) {
			const gx = chunkX * N + i;
			const gz = chunkZ * N + j;
			const T = world.tier(gx, gz);
			const yT = T * STEP;
			const x = i * CELL;
			const z = j * CELL;
			const c = world.topColor(T);
			const d = world.rampDir(gx, gz);

			if (d) {
				// PENTE (herbe) + 2 faces latérales (terre).
				const yH = yT + STEP;
				const dx = d[0];
				const dz = d[1];
				const P = (ux: number, uz: number): Vtx => [
					x + ux * CELL,
					(ux - 0.5) * dx + (uz - 0.5) * dz > 0 ? yH : yT,
					z + uz * CELL,
					c,
				];
				quad(P(0, 0), P(1, 0), P(1, 1), P(0, 1), 0, 1, 0);
				for (const [nx, nz, ax, az, bx, bz] of EDGES) {
					if (nx * dx + nz * dz !== 0) continue; // arêtes parallèles à la pente
					const aHi = (ax - 0.5) * dx + (az - 0.5) * dz > 0;
					const hx = aHi ? ax : bx;
					const hz = aHi ? az : bz;
					const lx = aHi ? bx : ax;
					const lz = aHi ? bz : az;
					tri(
						[x + lx * CELL, yT, z + lz * CELL, DIRT],
						[x + hx * CELL, yH, z + hz * CELL, DIRT],
						[x + hx * CELL, yT, z + hz * CELL, DIRT],
						nx,
						0,
						nz,
					);
				}
			} else {
				// PLATEAU plat (herbe).
				quad(
					[x, yT, z, c],
					[x + CELL, yT, z, c],
					[x + CELL, yT, z + CELL, c],
					[x, yT, z + CELL, c],
					0,
					1,
					0,
				);
			}

			// FALAISES (terre) vers les voisins plus bas.
			for (const [nx, nz, ax, az, bx, bz] of EDGES) {
				const tn = world.tier(gx + nx, gz + nz);
				if (tn >= T) continue;
				const yL = tn * STEP;
				quad(
					[x + ax * CELL, yL, z + az * CELL, DIRT_DARK],
					[x + bx * CELL, yL, z + bz * CELL, DIRT_DARK],
					[x + bx * CELL, yT, z + bz * CELL, DIRT],
					[x + ax * CELL, yT, z + az * CELL, DIRT],
					nx,
					0,
					nz,
				);
			}
		}
	}

	const normals: number[] = [];
	VertexData.ComputeNormals(pos, idx, normals);
	const vd = new VertexData();
	vd.positions = pos;
	vd.indices = idx;
	vd.normals = normals;
	vd.colors = col;
	const mesh = new Mesh(`chunk_${chunkX}_${chunkZ}`, scene);
	vd.applyToMesh(mesh);
	mesh.position.set(chunkX * N * CELL, 0, chunkZ * N * CELL);
	if (flat) mesh.convertToFlatShadedMesh();
	mesh.material = mat;
	mesh.isPickable = false;
	// PAS de `doNotSyncBoundingInfo` ici : la boîte englobante est calculée par
	// `applyToMesh` en espace LOCAL, donc AVANT la translation du chunk. La
	// désactiver empêche `_afterComputeWorldMatrix` de la réévaluer et tous les
	// chunks se retrouvent avec la même boîte, posée sur l'origine du monde —
	// le frustum culling les fait alors disparaître ensemble dès qu'on ne
	// regarde plus vers l'origine. Le `freezeWorldMatrix` ci-dessous déclenche
	// l'unique recalcul nécessaire, puis fige la matrice : les frames suivantes
	// sortent de `computeWorldMatrix` sans rien resynchroniser.
	mesh.freezeWorldMatrix();
	return mesh;
}

export class TerrainChunk {
	readonly mesh: Mesh;

	constructor(
		scene: Scene,
		world: World,
		cx: number,
		cz: number,
		mat: StandardMaterial,
		flat: boolean,
	) {
		this.mesh = buildChunkMesh(scene, world, cx, cz, mat, flat);
	}

	dispose(): void {
		this.mesh.dispose();
	}
}
