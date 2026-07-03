type Stat = 'movespeed' | 'attackspeed' | 'attackdamage' | 'armor' | '';

type Rarity = 'common' | 'uncommon' | 'rare' | 'epic';

export interface StatUpgrade {
	stat: Stat;
	rarity: Rarity;
}

export class PlayerStats {
	private health!: number;
	private attackSpeed!: number;
	private moveSpeed!: number;
	private attackDamage!: number;
	private armor!: number;
	private luck!: number;
	private statsInventory: StatUpgrade[] = [];
	private killAmount!: number;
	private xp!: number;

	getHealth() {
		return this.health;
	}

	setHealth(health: number) {
		this.health = health;
	}

	getXp() {
		return this.xp;
	}

	setXp(xp: number) {
		this.xp = xp;
	}

	getAttackSpeed() {
		return this.attackSpeed;
	}

	setAttackSpeed(attackSpeed: number) {
		this.attackSpeed = attackSpeed;
	}

	getMoveSpeed() {
		return this.moveSpeed;
	}

	setMoveSpeed(moveSpeed: number) {
		this.moveSpeed = moveSpeed;
	}

	getAttackDamage() {
		return this.attackDamage;
	}

	setAttackDamage(attackDamage: number) {
		this.attackDamage = attackDamage;
	}

	getArmor() {
		return this.armor;
	}

	setArmor(armor: number) {
		this.armor = armor;
	}

	getLuck() {
		return this.luck;
	}

	setLuck(luck: number) {
		this.luck = luck;
	}

	addStatUpgrade(stat: Stat, rarity: Rarity) {
		const newUpgrade: StatUpgrade = { stat: stat, rarity: rarity };

		this.statsInventory.push(newUpgrade);
	}

	getKillAmount() {
		return this.killAmount;
	}

	setKillAmount(killAmount: number) {
		this.killAmount = killAmount;
	}
}
