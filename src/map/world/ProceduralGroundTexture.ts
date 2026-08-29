import * as BABYLON from '@babylonjs/core';
import { lerp } from '@transcendence/game-shared';
import { groundBiomeWeights, groundPathFactor } from './GroundFeatures';
import { fbm2d, smoothstep } from './ProceduralNoise';

/** Texture resolution in pixels. */
const GROUND_TEXTURE_SIZE = 512;
/** World-space size covered before the texture repeats. */
export const GROUND_TEXTURE_WORLD_SIZE = 1024;

function channel(value: number): number {
	return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * Makes the grass and ochre cracked path in CPU memory so it works without a
 * canvas or an external image asset. Coordinates are centred on world origin.
 */
export function createProceduralGroundTexture(
	scene: BABYLON.Scene,
	seed: number,
): BABYLON.RawTexture {
	const size = GROUND_TEXTURE_SIZE;
	const worldScale = GROUND_TEXTURE_WORLD_SIZE / size;
	const data = new Uint8Array(size * size * 4);

	for (let py = 0; py < size; py++) {
		for (let px = 0; px < size; px++) {
			const x = (px + 0.5 - size * 0.5) * worldScale;
			const z = (py + 0.5 - size * 0.5) * worldScale;
			const biome = groundBiomeWeights(x, z, seed);
			const grassVariation = fbm2d(
				x * 0.035,
				z * 0.035,
				seed ^ 0x6d2b79f5,
			);
			const fineVariation = fbm2d(
				x * 0.14 + 17,
				z * 0.14 - 9,
				seed ^ 0xa5a5a5a5,
			);
			const path = groundPathFactor(x, z, seed);
			const pathVariation = fbm2d(
				x * 0.055 - 3,
				z * 0.055 + 11,
				seed ^ 0x3c6ef372,
			);

			const meadow = [
				82 + grassVariation * 20 + fineVariation * 8,
				172 + grassVariation * 29 + fineVariation * 13,
				58 + grassVariation * 15 + fineVariation * 7,
			];
			const forest = [
				34 + grassVariation * 11 + fineVariation * 5,
				108 + grassVariation * 24 + fineVariation * 10,
				36 + grassVariation * 10 + fineVariation * 5,
			];
			const rocky = [
				124 + grassVariation * 18 + fineVariation * 6,
				137 + grassVariation * 20 + fineVariation * 8,
				88 + grassVariation * 14 + fineVariation * 6,
			];
			const ground = [0, 1, 2].map(
				(channelIndex) =>
					meadow[channelIndex] * biome.meadow +
					forest[channelIndex] * biome.forest +
					rocky[channelIndex] * biome.rocky,
			);
			const dirt = [
				171 + pathVariation * 26 + fineVariation * 5,
				133 + pathVariation * 23 + fineVariation * 8,
				55 + pathVariation * 15 + fineVariation * 5,
			];
			const crackWarp = fbm2d(x * 0.045 + 29, z * 0.045 - 7, seed);
			const crackA =
				1 -
				smoothstep(
					0,
					0.075,
					Math.abs(Math.sin(x * 0.31 + z * 0.035 + crackWarp * 3.5)),
				);
			const crackB =
				1 -
				smoothstep(
					0,
					0.065,
					Math.abs(Math.sin(z * 0.37 - x * 0.045 - crackWarp * 2.5)),
				);
			const cracks =
				Math.max(crackA, crackB) *
				smoothstep(0.3, 0.82, path) *
				(0.55 + 0.45 * (fineVariation * 0.5 + 0.5));

			const index = (py * size + px) * 4;
			for (let channelIndex = 0; channelIndex < 3; channelIndex++) {
				const blended = lerp(
					ground[channelIndex],
					dirt[channelIndex],
					path,
				);
				data[index + channelIndex] = channel(
					blended * (1 - cracks * 0.42),
				);
			}
			data[index + 3] = 255;
		}
	}

	const texture = BABYLON.RawTexture.CreateRGBATexture(
		data,
		size,
		size,
		scene,
		false,
		false,
		BABYLON.Texture.BILINEAR_SAMPLINGMODE,
		BABYLON.Constants.TEXTURETYPE_UNSIGNED_BYTE,
		0,
		true,
	);
	texture.name = 'procedural-ground';
	texture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
	texture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
	return texture;
}
