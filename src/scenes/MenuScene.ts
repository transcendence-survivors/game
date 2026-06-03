/**
 * @file Minimal Babylon `Scene` that backs the menu / lobby UI.
 *
 * The menu and lobby are drawn with Babylon GUI (a fullscreen
 * {@link AdvancedDynamicTexture}) so they share the canvas pipeline with the
 * in-game {@link LatencyPanel} — one rendering path, one visual language. This
 * scene carries no 3D content: just a clear color and an idle camera so the
 * engine has something to render the GUI layer on top of. Swapping to the real
 * game scene disposes this one (and its GUI) automatically.
 */

import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scene } from '@babylonjs/core/scene';

import type { GameEngine } from '../core/Engine';
import type { RenderConfig } from '../core/ConfigLoader';

/**
 * Build the backdrop scene for the menu UI.
 *
 * @param engine - The shared {@link GameEngine}.
 * @param config - Render config (reuses the gameplay clear color for continuity).
 */
export function createMenuScene(engine: GameEngine, config: RenderConfig): Scene {
	const scene = new Scene(engine.raw);
	scene.clearColor = Color4.FromHexString(ensureHex(config.clearColor));

	// An inert camera — the GUI layer needs an active camera to render, but the
	// menu has nothing to look at. No control is attached so it never steals
	// pointer events from the UI controls.
	const camera = new FreeCamera('menu-camera', new Vector3(0, 0, -1), scene);
	camera.inputs.clear();

	return scene;
}

/**
 * Babylon's `FromHexString` expects 7 or 9 chars (with leading `#`). Throws a
 * helpful error instead of silently producing black on a malformed value.
 */
function ensureHex(hex: string): string {
	if (!/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hex)) {
		throw new Error(`[MenuScene] Invalid hex color "${hex}" (expected #RRGGBB or #RRGGBBAA)`);
	}
	return hex;
}
