/**
 * @file Measures the local client's round-trip latency to the server.
 *
 * Protocol — purely application-level, no dependency on transport timestamps:
 *   1. On a fixed interval, emit {@link ClientMessage.Ping} carrying the local
 *      `performance.now()` value.
 *   2. The server echoes the same value back as {@link ServerMessage.Pong}.
 *   3. RTT = `now - echoedTimestamp`. Forward that value to the server as
 *      {@link ClientMessage.ReportLatency} so it can be written into the synced
 *      state and rendered in every peer's panel.
 *
 * The tracker only handles its own latency. Other players' values arrive via
 * the normal Colyseus state diff on `Player.latencyMs`.
 */

import type { Room } from 'colyseus.js';
import {
	ClientMessage,
	ServerMessage,
	type PingPayload,
	type PongPayload,
	type ReportLatencyPayload,
} from '@transcendence/game-shared';

/** Drop in-flight probes older than this — the server is unreachable or paused. */
const STALE_PROBE_MS = 10_000;

export class LatencyTracker {
	private readonly room: Room;
	private readonly intervalMs: number;
	private readonly inFlight = new Map<number, number>();
	private timer: ReturnType<typeof setInterval> | null = null;

	constructor(room: Room, intervalMs: number) {
		this.room = room;
		this.intervalMs = intervalMs;
	}

	/** Subscribe to Pong messages and start the probe loop. */
	attach(): void {
		this.room.onMessage(ServerMessage.Pong, (msg: PongPayload) => this.handlePong(msg));
		this.timer = setInterval(() => this.sendPing(), this.intervalMs);
		// Fire one immediately so the panel has a value within the first interval.
		this.sendPing();
	}

	/** Stop the probe loop. Does not unsubscribe — `room.leave()` tears that down. */
	detach(): void {
		if (this.timer !== null) {
			clearInterval(this.timer);
			this.timer = null;
		}
		this.inFlight.clear();
	}

	private sendPing(): void {
		const t = performance.now();
		this.inFlight.set(t, t);
		const payload: PingPayload = { t };
		this.room.send(ClientMessage.Ping, payload);
		this.evictStale();
	}

	private handlePong(msg: PongPayload): void {
		const sentAt = this.inFlight.get(msg.t);
		if (sentAt === undefined) {
			return;
		}
		this.inFlight.delete(msg.t);
		const rtt = performance.now() - sentAt;
		const report: ReportLatencyPayload = { latencyMs: rtt };
		this.room.send(ClientMessage.ReportLatency, report);
	}

	private evictStale(): void {
		const cutoff = performance.now() - STALE_PROBE_MS;
		for (const [key, sentAt] of this.inFlight) {
			if (sentAt < cutoff) {
				this.inFlight.delete(key);
			}
		}
	}
}
