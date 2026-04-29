export interface SwingAnimationConfig {
	fromAngle: number;
	toAngle: number;
	durationMs: number;
	hitWindowStart?: number;
	hitWindowEnd?: number;
}

export class SwingAnimation {
	private readonly _config: SwingAnimationConfig;
	private _startedAtMs: number | null = null;
	private _hitConsumed: boolean = false;

	constructor(config: SwingAnimationConfig) {
		this._config = config;
	}

	start(nowMs: number): boolean {
		if (this.isActive(nowMs)) return false;
		this._startedAtMs = nowMs;
		this._hitConsumed = false;
		return true;
	}

	isActive(nowMs: number): boolean {
		if (this._startedAtMs === null) return false;
		return nowMs - this._startedAtMs < this._config.durationMs;
	}

	isDone(nowMs: number): boolean {
		if (this._startedAtMs === null) return false;
		return nowMs - this._startedAtMs >= this._config.durationMs;
	}

	progress(nowMs: number): number {
		if (this._startedAtMs === null) return 0;
		const t = (nowMs - this._startedAtMs) / this._config.durationMs;
		return Math.max(0, Math.min(1, t));
	}

	angleAt(nowMs: number): number {
		const t = this.progress(nowMs);
		return this._config.fromAngle + (this._config.toAngle - this._config.fromAngle) * t;
	}

	isInHitWindow(nowMs: number): boolean {
		const start = this._config.hitWindowStart ?? 0;
		const end = this._config.hitWindowEnd ?? 1;
		const t = this.progress(nowMs);
		return this.isActive(nowMs) && t >= start && t <= end;
	}

	consumeHitFrame(nowMs: number): boolean {
		if (this._hitConsumed) return false;
		if (!this.isInHitWindow(nowMs)) return false;
		this._hitConsumed = true;
		return true;
	}
}
