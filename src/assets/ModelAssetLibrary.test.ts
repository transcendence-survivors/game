import type { AssetContainer, Scene } from '@babylonjs/core';
import { describe, expect, it, vi } from 'vitest';
import { AssetContainerCache } from './AssetContainerCache';
import { ModelAssetLibrary } from './ModelAssetLibrary';

describe('ModelAssetLibrary', () => {
	it('clones independent model meshes', async () => {
		const entries = { rootNodes: [{}], animationGroups: [] };
		const instantiateModelsToScene = vi.fn().mockReturnValue(entries);
		const container = {
			dispose: vi.fn(),
			instantiateModelsToScene,
		} as unknown as AssetContainer;
		const loader = vi.fn().mockResolvedValue(container);
		const library = new ModelAssetLibrary(
			{} as Scene,
			new AssetContainerCache({} as Scene, loader),
		);

		const result = await library.instantiate(
			'/grass.glb',
			'forest:grass:0',
		);

		expect(result.root).toBe(entries.rootNodes[0]);
		expect(instantiateModelsToScene).toHaveBeenCalledWith(
			expect.any(Function),
			false,
		);
		library.dispose();
	});

	it('can force independent meshes when per-instance state is required', async () => {
		const entries = { rootNodes: [{}], animationGroups: [] };
		const instantiateModelsToScene = vi.fn().mockReturnValue(entries);
		const container = {
			dispose: vi.fn(),
			instantiateModelsToScene,
		} as unknown as AssetContainer;
		const library = new ModelAssetLibrary(
			{} as Scene,
			new AssetContainerCache(
				{} as Scene,
				vi.fn().mockResolvedValue(container),
			),
		);

		await library.instantiate('/monster.glb', 'monster:1', {
			doNotInstantiate: true,
		});

		expect(instantiateModelsToScene).toHaveBeenCalledWith(
			expect.any(Function),
			false,
			{ doNotInstantiate: true },
		);
		library.dispose();
	});

	it('prepares a shared model once and retries a failed preparation', async () => {
		const container = { dispose: vi.fn() } as unknown as AssetContainer;
		const loader = vi.fn().mockResolvedValue(container);
		const assets = new AssetContainerCache({} as Scene, loader);
		const library = new ModelAssetLibrary({} as Scene, assets);
		const failedPreparation = vi
			.fn<(asset: AssetContainer) => void>()
			.mockImplementationOnce(() => {
				throw new Error('temporary preparation failure');
			});

		await expect(
			library.prepare('/monster.glb', failedPreparation),
		).rejects.toThrow('temporary preparation failure');

		const prepare = vi.fn<(asset: AssetContainer) => void>();
		await Promise.all([
			library.prepare('/monster.glb', prepare),
			library.prepare('/monster.glb', prepare),
		]);

		expect(loader).toHaveBeenCalledOnce();
		expect(prepare).toHaveBeenCalledOnce();
		expect(prepare).toHaveBeenCalledWith(container);

		library.dispose();
		await Promise.resolve();
		expect(container.dispose).toHaveBeenCalledOnce();
	});
});
