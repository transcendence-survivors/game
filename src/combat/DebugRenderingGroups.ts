import type * as BABYLON from '@babylonjs/core';

export const MONSTER_HITBOX_RENDERING_GROUP = 2;
export const COMBAT_HITBOX_RENDERING_GROUP = 3;

/**
 * Les groupes debug sont rendus après le monde mais doivent conserver sa
 * profondeur, utilisée ensuite par RadialLightingPostProcess.
 */
export function preserveWorldDepthForDebug(scene: BABYLON.Scene): void {
	scene.setRenderingAutoClearDepthStencil(
		MONSTER_HITBOX_RENDERING_GROUP,
		false,
		false,
		false,
	);
	scene.setRenderingAutoClearDepthStencil(
		COMBAT_HITBOX_RENDERING_GROUP,
		false,
		false,
		false,
	);
}
