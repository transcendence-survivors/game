import { describe, expect, test, vi } from 'vitest';
import type * as BABYLON from '@babylonjs/core';
import {
	COMBAT_HITBOX_RENDERING_GROUP,
	MONSTER_HITBOX_RENDERING_GROUP,
	preserveWorldDepthForDebug,
} from './DebugRenderingGroups';

describe('debug rendering groups', () => {
	test('never clears the world depth before hitbox overlays', () => {
		const setRenderingAutoClearDepthStencil = vi.fn();
		preserveWorldDepthForDebug({
			setRenderingAutoClearDepthStencil,
		} as unknown as BABYLON.Scene);
		expect(setRenderingAutoClearDepthStencil).toHaveBeenCalledWith(
			MONSTER_HITBOX_RENDERING_GROUP,
			false,
			false,
			false,
		);
		expect(setRenderingAutoClearDepthStencil).toHaveBeenCalledWith(
			COMBAT_HITBOX_RENDERING_GROUP,
			false,
			false,
			false,
		);
	});
});
