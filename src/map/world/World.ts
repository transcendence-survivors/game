import { makeNoise2D, type Noise2D } from './Noise';

export interface WorldColor {
	r: number;
	g: number;
	b: number;
}

/** Voisins orthogonaux (alloués une seule fois). */
const DIRS: ReadonlyArray<readonly [number, number]> = [
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1],
];

/** Clé entière de cache (sans collision pour |coord| < 8.4M). */
function keyOf(gx: number, gz: number): number {
	return (gx + 0x800000) * 0x1000000 + (gz + 0x800000);
}

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

export function clamp01(x: number): number {
	return x < 0 ? 0 : x > 1 ? 1 : x;
}

function mixC(a: WorldColor, b: WorldColor, t: number): WorldColor {
	return { r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) };
}

/**
 * Monde procédural : paliers CLAMPÉS (écart voisins <= 1 garanti => falaises
 * d'un seul palier, donc une pente unique relie toujours deux niveaux). Les
 * rampes sont parcimonieuses mais densifiées pour que tous les niveaux restent
 * reliés. Portage fidèle du prototype `data.html`.
 */
export class World {
	readonly seed: number;
	readonly CELL = 12;
	readonly N = 4;
	readonly STEP = 10;
	readonly TIERS = 8;

	private noise: Noise2D;
	private scaleDiv = 22;
	private octaves = 4;
	private contrast = 1.5; // pousse le relief vers les extrêmes
	private rampChance = 40; // % des liaisons valides converties en pente
	private fillR = 3; // rayon de fermeture morpho (rebouche les cuvettes)

	private rawCache = new Map<number, number>();
	private tierCache = new Map<number, number>();
	private dilateCache = new Map<number, number>();
	private closeCache = new Map<number, number>();

	constructor(seed: number) {
		this.seed = seed >>> 0;
		this.noise = makeNoise2D(this.seed);
	}

	private raw(wx: number, wz: number): number {
		const sc = 1 / (this.scaleDiv * 8);
		let amp = 1;
		let freq = 1;
		let sum = 0;
		let norm = 0;
		for (let i = 0; i < this.octaves; i++) {
			sum += amp * this.noise(wx * sc * freq, wz * sc * freq);
			norm += amp;
			amp *= 0.5;
			freq *= 2;
		}
		const detail = sum / norm; // détail [-1, 1]
		const macro = this.noise(wx * sc * 0.28, wz * sc * 0.28); // grande échelle
		const e = (0.58 * macro + 0.42 * detail + 1) * 0.5; // 0..1
		return clamp01((e - 0.5) * this.contrast + 0.5);
	}

	private rawTier(gx: number, gz: number): number {
		const k = keyOf(gx, gz);
		const cached = this.rawCache.get(k);
		if (cached !== undefined) return cached;
		let t = Math.floor(
			this.raw(
				gx * this.CELL + this.CELL * 0.5,
				gz * this.CELL + this.CELL * 0.5,
			) * this.TIERS,
		);
		if (t < 0) t = 0;
		else if (t > this.TIERS - 1) t = this.TIERS - 1;
		this.rawCache.set(k, t);
		return t;
	}

	/** Clamp 1-lipschitzien (min de cônes) par anneaux : voisins <= 1 palier. */
	private clamped(gx: number, gz: number): number {
		const k = keyOf(gx, gz);
		const cached = this.tierCache.get(k);
		if (cached !== undefined) return cached;
		let best = this.rawTier(gx, gz);
		const R = this.TIERS - 1;
		for (let r = 1; r <= R && r < best; r++) {
			let m = Infinity;
			for (let dx = -r; dx <= r; dx++) {
				const a = this.rawTier(gx + dx, gz - r);
				const b = this.rawTier(gx + dx, gz + r);
				if (a < m) m = a;
				if (b < m) m = b;
			}
			for (let dz = 1 - r; dz < r; dz++) {
				const a = this.rawTier(gx - r, gz + dz);
				const b = this.rawTier(gx + r, gz + dz);
				if (a < m) m = a;
				if (b < m) m = b;
			}
			if (m + r < best) best = m + r;
		}
		this.tierCache.set(k, best);
		return best;
	}

	private dilate(gx: number, gz: number): number {
		const k = keyOf(gx, gz);
		const cached = this.dilateCache.get(k);
		if (cached !== undefined) return cached;
		const r = this.fillR;
		let m = -Infinity;
		for (let dz = -r; dz <= r; dz++)
			for (let dx = -r; dx <= r; dx++) {
				const c = this.clamped(gx + dx, gz + dz);
				if (c > m) m = c;
			}
		this.dilateCache.set(k, m);
		return m;
	}

	/** Palier final = fermeture morpho (érosion d'une dilatation). */
	tier(gx: number, gz: number): number {
		if (this.fillR <= 0) return this.clamped(gx, gz);
		const k = keyOf(gx, gz);
		const cached = this.closeCache.get(k);
		if (cached !== undefined) return cached;
		if (this.closeCache.size > 250000) {
			this.closeCache.clear();
			this.dilateCache.clear();
			this.tierCache.clear();
			this.rawCache.clear();
		}
		const r = this.fillR;
		let m = Infinity;
		for (let dz = -r; dz <= r; dz++)
			for (let dx = -r; dx <= r; dx++) {
				const c = this.dilate(gx + dx, gz + dz);
				if (c < m) m = c;
			}
		this.closeCache.set(k, m);
		return m;
	}

	topColor(T: number): WorldColor {
		const t = this.TIERS <= 1 ? 0 : T / (this.TIERS - 1);
		const grass: WorldColor = { r: 0.36, g: 0.55, b: 0.27 };
		const grass2: WorldColor = { r: 0.3, g: 0.48, b: 0.23 };
		const rock: WorldColor = { r: 0.5, g: 0.47, b: 0.43 };
		const snow: WorldColor = { r: 0.95, g: 0.96, b: 0.98 };
		if (t < 0.6) return mixC(grass, grass2, t / 0.6);
		if (t < 0.85) return mixC(grass2, rock, (t - 0.6) / 0.25);
		return mixC(rock, snow, (t - 0.85) / 0.15);
	}

	private hash(gx: number, gz: number): number {
		let h = (Math.imul(gx | 0, 374761393) + Math.imul(gz | 0, 668265263)) ^ this.seed;
		h = Math.imul(h ^ (h >>> 13), 1274126177);
		return (h ^ (h >>> 16)) >>> 0;
	}

	/** Pente "candidate" : une case montant T->T+1 avec arrière plat T. */
	private slopeCandidate(gx: number, gz: number): readonly [number, number] | null {
		const T = this.tier(gx, gz);
		const cand: Array<readonly [number, number]> = [];
		for (const d of DIRS)
			if (
				this.tier(gx + d[0], gz + d[1]) === T + 1 &&
				this.tier(gx - d[0], gz - d[1]) === T
			)
				cand.push(d);
		if (!cand.length) return null;
		const h = this.hash(gx, gz);
		return h % 100 >= this.rampChance ? null : cand[(h >>> 8) % cand.length];
	}

	/** Pente FINALE : retire les pentes adjacentes de sens différent. */
	rampDir(gx: number, gz: number): readonly [number, number] | null {
		const d = this.slopeCandidate(gx, gz);
		if (!d) return null;
		const h = this.hash(gx, gz);
		for (const n of DIRS) {
			const dn = this.slopeCandidate(gx + n[0], gz + n[1]);
			if (
				dn &&
				(dn[0] !== d[0] || dn[1] !== d[1]) &&
				this.hash(gx + n[0], gz + n[1]) < h
			)
				return null;
		}
		return d;
	}

	/** Hauteur du sol : plat = palier ; pente = interpolé (snap joueur). */
	height(wx: number, wz: number): number {
		const gx = Math.floor(wx / this.CELL);
		const gz = Math.floor(wz / this.CELL);
		const base = this.tier(gx, gz) * this.STEP;
		const d = this.rampDir(gx, gz);
		if (!d) return base;
		const u = wx / this.CELL - gx;
		const v = wz / this.CELL - gz;
		if (d[0] === 1) return base + this.STEP * u;
		if (d[0] === -1) return base + this.STEP * (1 - u);
		if (d[1] === 1) return base + this.STEP * v;
		return base + this.STEP * (1 - v);
	}
}
