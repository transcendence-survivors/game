/**
 * @file Builds the Babylon `Scene` for the gameplay view: flat ground,
 * ambient light, orbital camera. Owns no players — those are managed by
 * {@link PlayerRegistry}, which attaches meshes to this scene.
 */

import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Scene } from '@babylonjs/core/scene';

import type { GameEngine } from '../core/Engine';
import type { RenderConfig } from '../core/ConfigLoader';

/**
 * Create and return the gameplay {@link Scene}.
 *
 * The scene is fully constructed before being returned — caller just calls
 * `engine.setScene(scene)` to display it.
 */
export function createGameScene(engine: GameEngine, config: RenderConfig): Scene {
	const scene = new Scene(engine.raw);
	scene.clearColor = Color4.FromHexString(ensureHex(config.clearColor));

	new HemisphericLight('ambient', new Vector3(0, 1, 0), scene).intensity = config.ambientIntensity;

	const camera = new ArcRotateCamera(
		'camera',
		config.cameraAlpha,
		config.cameraBeta,
		config.cameraRadius,
		new Vector3(0, config.cameraTargetY, 0),
		scene,
	);
	camera.attachControl(engine.canvasElement, true);
	camera.lowerRadiusLimit = 4;
	camera.upperRadiusLimit = 40;

	const ground = CreateGround('ground', { width: config.groundSize, height: config.groundSize }, scene);
	const groundMat = new StandardMaterial('groundMat', scene);
	groundMat.diffuseColor = Color3.FromHexString(ensureHex(config.groundColor));
	groundMat.specularColor = new Color3(0.1, 0.1, 0.1);
	ground.material = groundMat;

	return scene;
}

/**
 * Babylon's `FromHexString` expects 7 or 9 chars (with leading `#`). Throws a
 * helpful error instead of silently producing black on a malformed value.
 */
function ensureHex(hex: string): string {
	if (!/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hex)) {
		throw new Error(`[GameScene] Invalid hex color "${hex}" (expected #RRGGBB or #RRGGBBAA)`);
	}
	return hex;
}
