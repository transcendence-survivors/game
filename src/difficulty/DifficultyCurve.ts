export interface UnlockEntry {
	typeId: string;
	timeMs: number;
}

export interface DifficultyCurveConfig {
	baseMaxMonsters: number;
	monstersPerMinute: number;
	hardCapMonsters: number;
	baseSpawnIntervalMs: number;
	minSpawnIntervalMs: number;
	spawnIntervalDecayPerSecondMs: number;
	unlocks: UnlockEntry[];
}

export class DifficultyCurve {
	private readonly _config: DifficultyCurveConfig;
	private readonly _sortedUnlocks: UnlockEntry[];

	constructor(config: DifficultyCurveConfig) {
		this._config = config;
		this._sortedUnlocks = [...config.unlocks].sort((a, b) => a.timeMs - b.timeMs);
	}

	maxMonstersAt(elapsedMs: number): number {
		const minutes = elapsedMs / 60_000;
		const raw = this._config.baseMaxMonsters + minutes * this._config.monstersPerMinute;
		return Math.min(this._config.hardCapMonsters, Math.floor(raw));
	}

	spawnIntervalAt(elapsedMs: number): number {
		const seconds = elapsedMs / 1000;
		const decay = seconds * this._config.spawnIntervalDecayPerSecondMs;
		const value = this._config.baseSpawnIntervalMs - decay;
		return Math.max(this._config.minSpawnIntervalMs, value);
	}

	unlockedTypeIdsAt(elapsedMs: number): string[] {
		return this._sortedUnlocks
			.filter(u => elapsedMs >= u.timeMs)
			.map(u => u.typeId);
	}
}
