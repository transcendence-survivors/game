export type Noise2D = (x: number, y: number) => number;

/**
 * Bruit simplex 2D seedable (portage fidèle du prototype `data.html`).
 * Le générateur pseudo-aléatoire mélange une table de permutations, ce qui
 * rend le terrain reproductible pour une seed donnée.
 */
export function makeNoise2D(seed: number): Noise2D {
	let s = seed >>> 0;
	function rand(): number {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	const p = new Uint8Array(256);
	for (let i = 0; i < 256; i++) p[i] = i;
	for (let i = 255; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		const t = p[i];
		p[i] = p[j];
		p[j] = t;
	}

	const perm = new Uint8Array(512);
	const pm12 = new Uint8Array(512);
	for (let i = 0; i < 512; i++) {
		perm[i] = p[i & 255];
		pm12[i] = perm[i] % 12;
	}

	const g = new Float32Array([
		1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1,
		0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1,
	]);
	const F2 = 0.5 * (Math.sqrt(3) - 1);
	const G2 = (3 - Math.sqrt(3)) / 6;

	return function (xin: number, yin: number): number {
		let n0: number, n1: number, n2: number;
		const sk = (xin + yin) * F2;
		const i = Math.floor(xin + sk);
		const j = Math.floor(yin + sk);
		const t = (i + j) * G2;
		const x0 = xin - (i - t);
		const y0 = yin - (j - t);
		let i1: number, j1: number;
		if (x0 > y0) {
			i1 = 1;
			j1 = 0;
		} else {
			i1 = 0;
			j1 = 1;
		}
		const x1 = x0 - i1 + G2;
		const y1 = y0 - j1 + G2;
		const x2 = x0 - 1 + 2 * G2;
		const y2 = y0 - 1 + 2 * G2;
		const ii = i & 255;
		const jj = j & 255;
		const gi0 = pm12[ii + perm[jj]] * 3;
		const gi1 = pm12[ii + i1 + perm[jj + j1]] * 3;
		const gi2 = pm12[ii + 1 + perm[jj + 1]] * 3;
		let t0 = 0.5 - x0 * x0 - y0 * y0;
		if (t0 < 0) {
			n0 = 0;
		} else {
			t0 *= t0;
			n0 = t0 * t0 * (g[gi0] * x0 + g[gi0 + 1] * y0);
		}
		let t1 = 0.5 - x1 * x1 - y1 * y1;
		if (t1 < 0) {
			n1 = 0;
		} else {
			t1 *= t1;
			n1 = t1 * t1 * (g[gi1] * x1 + g[gi1 + 1] * y1);
		}
		let t2 = 0.5 - x2 * x2 - y2 * y2;
		if (t2 < 0) {
			n2 = 0;
		} else {
			t2 *= t2;
			n2 = t2 * t2 * (g[gi2] * x2 + g[gi2 + 1] * y2);
		}
		return 70 * (n0 + n1 + n2);
	};
}
