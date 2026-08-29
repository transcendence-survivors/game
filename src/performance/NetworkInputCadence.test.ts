import { describe, expect, test } from 'vitest';
import { MAX_DT } from '@transcendence/game-shared';
import {
	NETWORK_HEARTBEAT_INTERVAL_S,
	NETWORK_MOVE_INTERVAL_S,
	NetworkInputCadence,
} from './NetworkInputCadence';

describe('NetworkInputCadence', () => {
	test('does not send one packet per render frame', () => {
		const cadence = new NetworkInputCadence();

		expect(cadence.advance(0.001, true)).toBeCloseTo(0.001);
		expect(cadence.advance(0.005, true)).toBeNull();
		expect(cadence.advance(0.029, true)).toBeCloseTo(0.034);
	});

	test('keeps a heartbeat while idle and sends transitions immediately', () => {
		const cadence = new NetworkInputCadence();

		cadence.advance(0, false);
		expect(cadence.advance(NETWORK_HEARTBEAT_INTERVAL_S * 0.5, false)).toBeNull();
		expect(cadence.advance(NETWORK_HEARTBEAT_INTERVAL_S * 0.5, false)).toBe(
			MAX_DT,
		);

		const movingCadence = new NetworkInputCadence();
		movingCadence.advance(0, false);
		expect(movingCadence.advance(0.001, true)).toBeCloseTo(0.001);
	});

	test('bounds a stalled frame packet to the server simulation step', () => {
		const cadence = new NetworkInputCadence();
		cadence.advance(0, true);

		expect(cadence.advance(1, true)).toBe(MAX_DT);
	});

	test('uses the movement interval after a transition', () => {
		const cadence = new NetworkInputCadence();
		cadence.advance(0, true);
		cadence.advance(NETWORK_MOVE_INTERVAL_S, true);
		expect(cadence.advance(NETWORK_MOVE_INTERVAL_S * 0.5, true)).toBeNull();
	});

	test('never applies stale idle time retroactively to a jump', () => {
		const cadence = new NetworkInputCadence();
		cadence.advance(0, false);
		expect(cadence.advance(0.15, false)).toBeNull();

		expect(cadence.advance(1 / 60, true, true)).toBeCloseTo(1 / 60);
		expect(cadence.takePreviousStateDeltaTime()).toBe(MAX_DT);
		expect(cadence.pendingDeltaTime()).toBe(0);
	});

	test('exposes prediction time not sent to the server yet', () => {
		const cadence = new NetworkInputCadence();
		cadence.advance(0, true);
		expect(cadence.advance(0.01, true)).toBeNull();

		expect(cadence.pendingDeltaTime()).toBeCloseTo(0.01);
	});
});
