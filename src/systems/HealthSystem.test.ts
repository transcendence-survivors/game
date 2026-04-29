import { describe, it, expect, vi } from 'vitest';
import { HealthSystem } from './HealthSystem';

describe('HealthSystem', () => {
	it('starts at full HP', () => {
		const hs = new HealthSystem(100);
		expect(hs.current).toBe(100);
		expect(hs.max).toBe(100);
		expect(hs.isDead).toBe(false);
	});

	it('damage reduces HP', () => {
		const hs = new HealthSystem(100);
		hs.damage(30);
		expect(hs.current).toBe(70);
	});

	it('heal restores HP', () => {
		const hs = new HealthSystem(100);
		hs.damage(50);
		hs.heal(20);
		expect(hs.current).toBe(70);
	});

	it('clamps HP to max on heal', () => {
		const hs = new HealthSystem(100);
		hs.heal(50);
		expect(hs.current).toBe(100);
	});

	it('clamps HP to 0 on damage', () => {
		const hs = new HealthSystem(100);
		hs.damage(150);
		expect(hs.current).toBe(0);
	});

	it('isDead returns true when current <= 0', () => {
		const hs = new HealthSystem(100);
		hs.damage(100);
		expect(hs.isDead).toBe(true);
	});

	it('ratio returns current / max', () => {
		const hs = new HealthSystem(200);
		hs.damage(50);
		expect(hs.ratio).toBeCloseTo(0.75);
	});

	it('ignores further damage once dead', () => {
		const hs = new HealthSystem(100);
		hs.damage(200);
		const callback = vi.fn();
		hs.onChange(callback);
		hs.damage(10);
		expect(hs.current).toBe(0);
		expect(callback).not.toHaveBeenCalled();
	});

	it('notifies observers on change', () => {
		const hs = new HealthSystem(100);
		const callback = vi.fn();
		hs.onChange(callback);
		hs.damage(20);
		expect(callback).toHaveBeenCalledWith(80, 100);
	});

	it('triggers onDeath exactly once when HP hits 0', () => {
		const hs = new HealthSystem(100);
		const onDeath = vi.fn();
		hs.onDeath(onDeath);
		hs.damage(50);
		expect(onDeath).not.toHaveBeenCalled();
		hs.damage(50);
		expect(onDeath).toHaveBeenCalledTimes(1);
	});

	it('rejects negative arguments to damage/heal', () => {
		const hs = new HealthSystem(100);
		expect(() => hs.damage(-1)).toThrow();
		expect(() => hs.heal(-1)).toThrow();
	});
});
