import { HUD_BAR_FILL_PERCENT } from './HudConstants';

interface BossHealthCandidate {
	isBoss: boolean;
	life: { current: number };
}

export function isLivingBoss(monster: BossHealthCandidate): boolean {
	return (
		monster.isBoss &&
		Number.isFinite(monster.life.current) &&
		monster.life.current > 0
	);
}

export function normalizedLifeRatio(current: number, max: number): number {
	if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0)
		return 0;
	return Math.min(1, Math.max(0, current / max));
}

export function hudBarWidth(
	current: number,
	max: number,
	fillPercent = HUD_BAR_FILL_PERCENT,
): string {
	return `${(normalizedLifeRatio(current, max) * fillPercent).toFixed(2)}%`;
}

export function formatGameTime(totalSeconds: number): string {
	const safeSeconds = Number.isFinite(totalSeconds)
		? Math.max(0, Math.floor(totalSeconds))
		: 0;
	const seconds = safeSeconds % 60;
	const totalMinutes = Math.floor(safeSeconds / 60);
	const minutes = totalMinutes % 60;
	const pad = (value: number) => String(value).padStart(2, '0');

	return totalMinutes >= 60
		? `${pad(Math.floor(totalMinutes / 60))}:${pad(minutes)}:${pad(seconds)}`
		: `${pad(totalMinutes)}:${pad(seconds)}`;
}
