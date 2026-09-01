import type { AssetContainer, Scene } from '@babylonjs/core';
import { describe, expect, it, vi } from 'vitest';
import { AssetContainerCache } from './AssetContainerCache';

describe('AssetContainerCache', () => {
	it('shares pending loads and retries a failed load', async () => {
		const container = { dispose: vi.fn() } as unknown as AssetContainer;
		const loader = vi
			.fn<(url: string, scene: Scene) => Promise<AssetContainer>>()
			.mockRejectedValueOnce(new Error('temporary failure'))
			.mockResolvedValue(container);
		const cache = new AssetContainerCache({} as Scene, loader);

		await expect(cache.load('/monster.glb')).rejects.toThrow(
			'temporary failure',
		);
		const retry = cache.load('/monster.glb');
		expect(cache.load('/monster.glb')).toBe(retry);
		await expect(retry).resolves.toBe(container);
		expect(loader).toHaveBeenCalledTimes(2);

		cache.dispose();
		await Promise.resolve();
		expect(container.dispose).toHaveBeenCalledOnce();
	});
});
