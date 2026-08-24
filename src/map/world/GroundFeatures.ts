import { TAU } from '@transcendence/game-shared';
import { fbm2d, smoothstep } from './ProceduralNoise';

function pathBand(distance: number, innerRadius: number, outerRadius: number) {
	return 1 - smoothstep(innerRadius, outerRadius, Math.abs(distance));
}

interface GroundBiomeWeights {
	readonly meadow: number;
	readonly forest: number;
	readonly rocky: number;
}

/**
 * Broad biome weights shared by the ground palette and the decoration pass.
 * The low frequency keeps a biome readable for several chunks before a soft
 * transition, while a second field gives rocky highlands their own identity.
 */
export function groundBiomeWeights(
	x: number,
	z: number,
	seed: number,
): GroundBiomeWeights {
	const climate =
		0.5 + 0.5 * fbm2d(x * 0.006 + 17, z * 0.006 - 11, seed ^ 0x68bc21eb);
	const elevation =
		0.5 + 0.5 * fbm2d(x * 0.009 - 23, z * 0.009 + 19, seed ^ 0x3c6ef372);
	const forestScore =
		0.15 +
		smoothstep(0.42, 0.68, climate) *
			(1 - smoothstep(0.68, 0.88, elevation)) *
			1.25;
	const rockyScore =
		0.1 +
		smoothstep(0.48, 0.72, elevation) * 1.35 +
		smoothstep(0.68, 0.9, climate) * 0.25;
	const meadowScore =
		0.2 +
		smoothstep(0.3, 0.62, 1 - climate) *
			(1 - smoothstep(0.66, 0.84, elevation) * 0.55) *
			0.95 +
		(1 - elevation) * 0.12;
	// Sharpen the normalized weights so neighboring chunks transition softly,
	// but a dominant biome still reads as a real region instead of a uniform
	// average of all three palettes.
	const sharpen = (score: number) => score ** 1.65;
	const sharpMeadow = sharpen(meadowScore);
	const sharpForest = sharpen(forestScore);
	const sharpRocky = sharpen(rockyScore);
	const total = sharpMeadow + sharpForest + sharpRocky;
	return {
		meadow: sharpMeadow / total,
		forest: sharpForest / total,
		rocky: sharpRocky / total,
	};
}

/**
 * Shared deterministic path mask used by both the ground texture and scenery.
 * Keeping the field in one pure module makes visual paths and clearings agree
 * at chunk boundaries without putting decorative data in the game state.
 */
export function groundPathFactor(x: number, z: number, seed: number): number {
	const phase = ((seed >>> 0) / 4294967296) * TAU;
	const centerLine =
		0.12 * x +
		13 * (Math.sin(x * 0.028 + phase) - Math.sin(phase)) +
		5 * (Math.sin(x * 0.075 - phase * 0.5) - Math.sin(-phase * 0.5));
	const mainPath = pathBand(z - centerLine, 4.5, 10.5);

	const branchLine =
		-72 + 0.12 * z + 14 * (Math.sin(z * 0.035 + phase) - Math.sin(phase));
	const branchPath = pathBand(x - branchLine, 3.5, 8.5) * 0.88;
	return Math.max(mainPath, branchPath);
}
