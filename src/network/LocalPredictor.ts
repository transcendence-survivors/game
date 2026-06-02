/**
 * @file Client-side prediction + server reconciliation for the LOCAL player.
 *
 * Without prediction the local paddle only moves once a snapshot echoing the
 * input has made the full round-trip (input send → server tick → state patch →
 * back over the wire). That round-trip is exactly the "reaction time" the
 * player feels. Prediction removes it: the moment an input is sent we apply it
 * locally so the cube moves *now*, and we fold the authoritative snapshots back
 * in afterwards.
 *
 * Scope — **horizontal plane only** (X/Z). Vertical motion (the jump arc) stays
 * fully server-authoritative and is interpolated like a remote player: jump-
 * height lag is far less perceptible than lateral input lag, and predicting it
 * would require the server to also broadcast vertical velocity / grounded state
 * to reconcile correctly. The horizontal model is velocity = input × moveSpeed,
 * which mirrors {@link MovementSystem} + the XZ integration of `PhysicsSystem`.
 *
 * Reconciliation (Gabriel-Gambetta style):
 *  1. Every sent input is buffered, tagged with its {@link InputCommand.seq}.
 *  2. When a snapshot arrives it carries `lastSeq` — the latest input the
 *     server has applied. We drop every buffered input up to and including it.
 *  3. We reset the predicted X/Z to the authoritative snapshot, then replay the
 *     still-pending inputs on top. The result is "where the server will be once
 *     it has processed everything we've already sent" — i.e. the present.
 */

import type { InputCommand } from '@transcendence/game-shared';

/** Mutable XYZ position. Only X and Z are predicted; Y is copied from the server. */
interface Vec3 {
	x: number;
	y: number;
	z: number;
}

/**
 * Upper bound on buffered un-acked inputs. At 60 Hz this is ~4 s of input —
 * far beyond any sane RTT. It only matters if the server stops acknowledging
 * (e.g. a stalled connection), where it caps memory instead of growing without
 * limit.
 */
const MAX_PENDING = 240;

export class LocalPredictor {
	/** Horizontal speed when an axis is fully held (m/s). Mirrors the server. */
	private readonly moveSpeed: number;
	/**
	 * Seconds advanced per buffered input. Set to `1 / sendRateHz` so the
	 * predicted speed equals `moveSpeed` regardless of the configured rate (one
	 * step per send × sendRate steps/s × moveSpeed × 1/sendRate = moveSpeed/s).
	 */
	private readonly stepDt: number;

	private readonly pos: Vec3 = { x: 0, y: 0, z: 0 };
	private pending: InputCommand[] = [];
	private ready = false;

	constructor(moveSpeed: number, sendRateHz: number) {
		this.moveSpeed = moveSpeed;
		this.stepDt = 1 / sendRateHz;
	}

	/** True once seeded from the first authoritative snapshot. */
	get isReady(): boolean {
		return this.ready;
	}

	/** Seed the predicted position from the first authoritative snapshot. */
	init(x: number, y: number, z: number): void {
		this.pos.x = x;
		this.pos.y = y;
		this.pos.z = z;
		this.pending = [];
		this.ready = true;
	}

	/**
	 * Apply a just-sent input locally so the cube moves immediately, and buffer
	 * it for later reconciliation. Returns the new predicted position (a shared
	 * reference — read it before the next call).
	 */
	applyInput(cmd: InputCommand): Readonly<Vec3> {
		this.pending.push(cmd);
		if (this.pending.length > MAX_PENDING) {
			this.pending.shift();
		}
		this.step(cmd);
		return this.pos;
	}

	/**
	 * Fold an authoritative snapshot back in: drop inputs the server has already
	 * applied (`seq <= lastSeq`), reset X/Z to the server position, then replay
	 * the still-pending inputs. Y is taken verbatim from the server.
	 */
	reconcile(x: number, y: number, z: number, lastSeq: number): Readonly<Vec3> {
		this.pending = this.pending.filter((cmd) => cmd.seq > lastSeq);
		this.pos.x = x;
		this.pos.y = y;
		this.pos.z = z;
		for (const cmd of this.pending) {
			this.step(cmd);
		}
		return this.pos;
	}

	/**
	 * One horizontal integration step — the exact XZ math the server runs in
	 * {@link MovementSystem} (normalize diagonal, scale by moveSpeed) followed by
	 * `position += velocity × dt` from `PhysicsSystem`.
	 */
	private step(cmd: InputCommand): void {
		const mx = clamp(cmd.moveX, -1, 1);
		const mz = clamp(cmd.moveZ, -1, 1);
		const len = Math.hypot(mx, mz);
		const nx = len > 1 ? mx / len : mx;
		const nz = len > 1 ? mz / len : mz;
		this.pos.x += nx * this.moveSpeed * this.stepDt;
		this.pos.z += nz * this.moveSpeed * this.stepDt;
	}
}

function clamp(v: number, lo: number, hi: number): number {
	return v < lo ? lo : v > hi ? hi : v;
}
