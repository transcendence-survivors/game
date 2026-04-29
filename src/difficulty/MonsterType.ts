export interface ColorRgb {
	r: number;
	g: number;
	b: number;
}

export interface MonsterType {
	id: string;
	color: ColorRgb;
	maxHp: number;
	damage: number;
	speed: number;
	width: number;
	height: number;
	radius: number;
	attackRange: number;
	attackCooldownMs: number;
	spawnWeight: number;
}
