/**
 * @file Periodic sampler for live perf metrics shown in the latency panel:
 * client FPS (from Babylon's smoothed counter) and observed server TPS
 * (derived from the delta of `state.tick` between two samples).
 *
 * The sampler is a passive producer: it computes values on an interval and
 * pushes them out through the callbacks supplied at construction. It owns
 * no UI.
 *
 * Note on TPS accuracy: the client only receives state diffs at the Colyseus
 * `patchRate` (~20 Hz by default), so very short windows produce jittery
 * readings. The default 500 ms window is wide enough for a stable display.
 */

import type { GameEngine } from './Engine';

export interface StatsSamplerCallbacks {
	readonly onFps: (fps: number) => void;
	readonly onTps: (tps: number) => void;
}

export interface StatsSamplerOptions {
	/** How often metrics are recomputed and emitted, in ms. */
	readonly intervalMs: number;
}

export class StatsSampler {
	private readonly engine: GameEngine;
	private readonly getServerTick: () => number;
	private readonly callbacks: StatsSamplerCallbacks;
	private readonly intervalMs: number;
	private timer: ReturnType<typeof setInterval> | null = null;
	private lastTick = 0;
	private lastSampleAt = 0;

	constructor(
		engine: GameEngine,
		getServerTick: () => number,
		callbacks: StatsSamplerCallbacks,
		options: StatsSamplerOptions,
	) {
		this.engine = engine;
		this.getServerTick = getServerTick;
		this.callbacks = callbacks;
		this.intervalMs = options.intervalMs;
	}

	attach(): void {
		this.lastTick = this.getServerTick();
		this.lastSampleAt = performance.now();
		this.timer = setInterval(() => this.sample(), this.intervalMs);
	}

	detach(): void {
		if (this.timer !== null) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}

	private sample(): void {
		const now = performance.now();
		const tick = this.getServerTick();
		const dtSec = (now - this.lastSampleAt) / 1000;
		// Guard against the clock jumping (tab background → foreground).
		if (dtSec > 0) {
			const deltaTick = tick - this.lastTick;
			// Wrap-safety: the server resets `tick` near MAX_SAFE_INTEGER. A
			// negative delta means we just crossed that boundary — skip this
			// sample rather than reporting a wildly negative TPS.
			if (deltaTick >= 0) {
				this.callbacks.onTps(deltaTick / dtSec);
			}
		}
		this.callbacks.onFps(this.engine.raw.getFps());
		this.lastTick = tick;
		this.lastSampleAt = now;
	}
}
