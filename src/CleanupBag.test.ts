import { describe, expect, it, vi } from 'vitest';
import { CleanupBag, CleanupRegistry } from './CleanupBag';

describe('CleanupBag', () => {
	it('disposes in reverse order and immediately cleans late resources', () => {
		const order: number[] = [];
		const lateCleanup = vi.fn();
		const bag = new CleanupBag();
		bag.add(
			() => order.push(1),
			() => order.push(2),
		);

		bag.dispose();
		bag.dispose();
		bag.add(lateCleanup);

		expect(order).toEqual([2, 1]);
		expect(lateCleanup).toHaveBeenCalledOnce();
	});
});

describe('CleanupRegistry', () => {
	it('owns replacement, deletion and late scopes', () => {
		const registry = new CleanupRegistry<string>();
		const firstCleanup = vi.fn();
		const secondCleanup = vi.fn();
		const lateCleanup = vi.fn();
		const first = registry.replace('player');
		first.add(firstCleanup);
		const second = registry.replace('player');
		second.add(secondCleanup);

		expect(firstCleanup).toHaveBeenCalledOnce();
		expect(registry.isCurrent('player', first)).toBe(false);
		expect(registry.isCurrent('player', second)).toBe(true);

		registry.dispose();
		registry.replace('late').add(lateCleanup);

		expect(secondCleanup).toHaveBeenCalledOnce();
		expect(lateCleanup).toHaveBeenCalledOnce();
	});
});
