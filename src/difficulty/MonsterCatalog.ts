import type { MonsterType } from './MonsterType';

export class MonsterCatalog {
	private readonly _byId: Map<string, MonsterType> = new Map();

	constructor(types: MonsterType[]) {
		for (const t of types) this._byId.set(t.id, t);
	}

	getById(id: string): MonsterType {
		const type = this._byId.get(id);
		if (!type) throw new Error(`Unknown monster type: ${id}`);
		return type;
	}

	pickRandom(unlockedIds: readonly string[], rng: () => number = Math.random): MonsterType {
		if (unlockedIds.length === 0) {
			throw new Error('Cannot pick from an empty unlocked list');
		}
		const types = unlockedIds.map(id => this.getById(id));
		const totalWeight = types.reduce((acc, t) => acc + t.spawnWeight, 0);
		if (totalWeight <= 0) return types[0];

		const roll = rng() * totalWeight;
		let acc = 0;
		for (const type of types) {
			acc += type.spawnWeight;
			if (roll < acc) return type;
		}
		return types[types.length - 1];
	}
}
