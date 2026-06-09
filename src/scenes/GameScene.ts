import type { Camera, Engine, GroundMesh, Light, Scene } from '@babylonjs/core';

export class GameScene {
	private scene: Scene;
	private engine: Engine;
	private camera: Camera;
	private light: Light;
	private ground: GroundMesh;

	constructor(engine: Engine) {}
}
