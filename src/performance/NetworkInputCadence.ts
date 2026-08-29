import { MAX_DT } from '@transcendence/game-shared';

/** Movement packets are intentionally independent from the render cadence. */
export const NETWORK_MOVE_INTERVAL_S = 1 / 30;
export const NETWORK_HEARTBEAT_INTERVAL_S = 1 / 5;

/**
 * Accumulates render time and tells the client when a movement packet is due.
 *
 * The accumulator keeps the excess time after a send, so a short frame does
 * not change the long-term packet rate. A direction transition is sent right
 * away: this prevents a quick key tap from being swallowed between two ticks.
 */
export class NetworkInputCadence {
	private elapsedS = 0;
	private previousStateDeltaTimeS = 0;
	private lastMoving = false;
	private started = false;

	advance(deltaTimeS: number, moving: boolean, force = false): number | null {
		this.previousStateDeltaTimeS = 0;
		const frameDeltaTime =
			Number.isFinite(deltaTimeS) && deltaTimeS > 0
				? Math.min(deltaTimeS, MAX_DT)
				: 0;
		this.elapsedS += frameDeltaTime;

		const interval = moving
			? NETWORK_MOVE_INTERVAL_S
			: NETWORK_HEARTBEAT_INTERVAL_S;
		const transitioned = this.started && moving !== this.lastMoving;
		if (
			!force &&
			this.started &&
			!transitioned &&
			this.elapsedS + Number.EPSILON < interval
		)
			return null;

		this.started = true;
		this.lastMoving = moving;
		// A new input state must not be applied retroactively to time accumulated
		// under the previous state (especially an edge-triggered jump).
		const changesInputState = transitioned || force;
		if (changesInputState)
			this.previousStateDeltaTimeS = Math.min(
				Math.max(0, this.elapsedS - frameDeltaTime),
				MAX_DT,
			);
		const packetDeltaTime = changesInputState
			? Math.max(frameDeltaTime, Number.EPSILON)
			: Math.min(Math.max(this.elapsedS, Number.EPSILON), MAX_DT);
		this.elapsedS = changesInputState
			? 0
			: Math.max(0, this.elapsedS - packetDeltaTime);
		return packetDeltaTime;
	}

	takePreviousStateDeltaTime(): number {
		const deltaTime = this.previousStateDeltaTimeS;
		this.previousStateDeltaTimeS = 0;
		return deltaTime;
	}

	pendingDeltaTime(): number {
		return Math.min(this.elapsedS, MAX_DT);
	}

	reset(): void {
		this.elapsedS = 0;
		this.previousStateDeltaTimeS = 0;
		this.lastMoving = false;
		this.started = false;
	}
}
