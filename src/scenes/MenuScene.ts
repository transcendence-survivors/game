import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scene } from '@babylonjs/core/scene';

import type { GameEngine } from '../core/Engine';
import type { RenderConfig } from '../core/ConfigLoader';

export function createMenuScene(
	engine: GameEngine,
	config: RenderConfig,
): Scene {
	const scene = new Scene(engine.raw);
	scene.clearColor = Color4.FromHexString(ensureHex(config.clearColor));

	// An inert camera — the GUI layer needs an active camera to render, but the
	// menu has nothing to look at. No control is attached so it never steals
	// pointer events from the UI controls.
	const camera = new FreeCamera('menu-camera', new Vector3(0, 0, -1), scene);
	camera.inputs.clear();

	return scene;
}

function ensureHex(hex: string): string {
	if (!/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hex)) {
		throw new Error(
			`[MenuScene] Invalid hex color "${hex}" (expected #RRGGBB or #RRGGBBAA)`,
		);
	}
	return hex;
}
