export type HealthChangeListener = (current: number, max: number) => void;
export type DeathListener = () => void;

export class HealthSystem {
	private readonly _max: number;
	private _current: number;
	private _changeListeners: HealthChangeListener[] = [];
	private _deathListeners: DeathListener[] = [];

	constructor(max: number) {
		if (max <= 0) throw new Error('HealthSystem requires max > 0');
		this._max = max;
		this._current = max;
	}

	get current(): number {
		return this._current;
	}

	get max(): number {
		return this._max;
	}

	get ratio(): number {
		return this._current / this._max;
	}

	get isDead(): boolean {
		return this._current <= 0;
	}

	damage(amount: number): void {
		if (amount < 0) throw new Error('damage amount must be >= 0');
		if (this.isDead) return;
		this._setCurrent(Math.max(0, this._current - amount));
		if (this._current === 0) this._deathListeners.forEach(l => l());
	}

	heal(amount: number): void {
		if (amount < 0) throw new Error('heal amount must be >= 0');
		if (this.isDead) return;
		this._setCurrent(Math.min(this._max, this._current + amount));
	}

	onChange(listener: HealthChangeListener): void {
		this._changeListeners.push(listener);
	}

	onDeath(listener: DeathListener): void {
		this._deathListeners.push(listener);
	}

	private _setCurrent(value: number): void {
		if (value === this._current) return;
		this._current = value;
		this._changeListeners.forEach(l => l(this._current, this._max));
	}
}
