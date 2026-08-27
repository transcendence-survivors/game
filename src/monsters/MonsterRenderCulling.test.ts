import { describe, expect, it } from 'vitest';
import {
	isMonsterInCameraEnvelope,
	type PlanarCameraView,
} from './MonsterRenderCulling';

const camera: PlanarCameraView = {
	cameraX: 0,
	cameraZ: 0,
	forwardX: 0,
	forwardZ: 1,
	halfFovTangent: 1,
};

describe('isMonsterInCameraEnvelope', () => {
	it('keeps monsters in front and at the edge of the envelope', () => {
		expect(isMonsterInCameraEnvelope(0, 20, camera, 5)).toBe(true);
		expect(isMonsterInCameraEnvelope(20, 20, camera, 5)).toBe(true);
	});

	it('culls monsters safely behind the camera', () => {
		expect(isMonsterInCameraEnvelope(0, -20, camera, 5)).toBe(false);
	});

	it('keeps a nearby monster even when it is behind the camera', () => {
		expect(isMonsterInCameraEnvelope(0, -3, camera, 5)).toBe(true);
	});
});
