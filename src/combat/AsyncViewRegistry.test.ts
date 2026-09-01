import { describe, expect, test, vi } from 'vitest';
import { AsyncViewRegistry } from './AsyncViewRegistry';

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => (resolve = done));
	return { promise, resolve };
}

function view() {
	return { dispose: vi.fn() };
}

describe('AsyncViewRegistry', () => {
	test('disposes a view removed while its asset is loading', async () => {
		const registry = new AsyncViewRegistry<ReturnType<typeof view>>();
		const loading = deferred<ReturnType<typeof view>>();
		const pending = registry.add('arrow', () => loading.promise);
		registry.remove('arrow');
		const loaded = view();
		loading.resolve(loaded);
		await pending;
		expect(loaded.dispose).toHaveBeenCalledOnce();
	});

	test('disposes pending and active views during teardown', async () => {
		const registry = new AsyncViewRegistry<ReturnType<typeof view>>();
		const active = view();
		await registry.add('active', async () => active);
		const loading = deferred<ReturnType<typeof view>>();
		const pending = registry.add('pending', () => loading.promise);
		registry.dispose();
		const late = view();
		loading.resolve(late);
		await pending;
		expect(active.dispose).toHaveBeenCalledOnce();
		expect(late.dispose).toHaveBeenCalledOnce();
	});

	test('clears a failed pending creation', async () => {
		const registry = new AsyncViewRegistry<ReturnType<typeof view>>();
		await expect(
			registry.add('failed', async () => {
				throw new Error('failed');
			}),
		).rejects.toThrow('failed');
		const loaded = view();
		await registry.add('failed', async () => loaded);
		expect(registry.get('failed')).toBe(loaded);
	});
});
