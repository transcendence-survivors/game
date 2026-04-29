import {
	Color3, Mesh, MeshBuilder, Scene, StandardMaterial,
	TransformNode, UniversalCamera, Vector3,
} from '@babylonjs/core';
import type { TerrainGenerator } from '../world/TerrainGenerator';
import type { InputManager } from '../systems/InputManager';

export interface PlayerConfig {
	speed: number;
	gravity: number;
	jumpForce: number;
	mouseSensitivity: number;
	tileSize: number;
	radius: number;
	startPosition: Vector3;
}

export class Player {
	private readonly _scene: Scene;
	private readonly _terrain: TerrainGenerator;
	private readonly _input: InputManager;
	private readonly _config: PlayerConfig;

	private readonly _mesh: Mesh;
	private readonly _cameraRoot: TransformNode;
	private readonly _camera: UniversalCamera;

	private _velocityY: number = 0;
	private _isGrounded: boolean = false;
	private _isThirdPerson: boolean = false;

	constructor(scene: Scene, terrain: TerrainGenerator, input: InputManager, config: PlayerConfig) {
		this._scene = scene;
		this._terrain = terrain;
		this._input = input;
		this._config = config;

		this._mesh = this._buildMesh();
		this._cameraRoot = this._buildCameraRoot();
		this._camera = this._buildCamera();
		this._wireMouseLook();
	}

	get mesh(): Mesh {
		return this._mesh;
	}

	get position(): Vector3 {
		return this._mesh.position;
	}

	get camera(): UniversalCamera {
		return this._camera;
	}

	toggleThirdPerson(): void {
		this._isThirdPerson = !this._isThirdPerson;
		this._camera.position = this._isThirdPerson ? new Vector3(0, 0, -10) : new Vector3(0, 0, 0);
	}

	update(): void {
		this._applyHorizontalMovement();
		this._applyVerticalMovement();
	}

	private _buildMesh(): Mesh {
		const mesh = MeshBuilder.CreateBox('player', { size: this._config.tileSize }, this._scene);
		const mat = new StandardMaterial('playerMat', this._scene);
		mat.diffuseColor = new Color3(0.8, 0.2, 0.2);
		mesh.material = mat;
		mesh.position = this._config.startPosition.clone();
		return mesh;
	}

	private _buildCameraRoot(): TransformNode {
		const root = new TransformNode('cameraRoot', this._scene);
		root.parent = this._mesh;
		root.position = new Vector3(0, 0.4, 0);
		return root;
	}

	private _buildCamera(): UniversalCamera {
		const cam = new UniversalCamera('Camera', new Vector3(0, 0, 0), this._scene);
		cam.parent = this._cameraRoot;
		cam.minZ = 0.05;
		cam.maxZ = 1000;
		return cam;
	}

	private _wireMouseLook(): void {
		this._input.onMouseMove((dx, dy) => {
			const sens = this._config.mouseSensitivity;
			this._mesh.rotation.y += dx * sens;
			this._cameraRoot.rotation.x += dy * sens;
			const maxPitch = Math.PI / 2.1;
			if (this._cameraRoot.rotation.x > maxPitch) this._cameraRoot.rotation.x = maxPitch;
			if (this._cameraRoot.rotation.x < -maxPitch) this._cameraRoot.rotation.x = -maxPitch;
		});
	}

	private _applyHorizontalMovement(): void {
		const forward = this._cameraRoot.getDirection(Vector3.Forward());
		forward.y = 0; forward.normalize();
		const right = this._cameraRoot.getDirection(Vector3.Right());
		right.y = 0; right.normalize();

		let moveX = 0; let moveZ = 0;
		if (this._input.isPressed('KeyW') || this._input.isPressed('KeyZ')) {
			moveX += forward.x; moveZ += forward.z;
		}
		if (this._input.isPressed('KeyS')) {
			moveX -= forward.x; moveZ -= forward.z;
		}
		if (this._input.isPressed('KeyD')) {
			moveX += right.x; moveZ += right.z;
		}
		if (this._input.isPressed('KeyA') || this._input.isPressed('KeyQ')) {
			moveX -= right.x; moveZ -= right.z;
		}

		const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
		if (len > 0) {
			moveX = (moveX / len) * this._config.speed;
			moveZ = (moveZ / len) * this._config.speed;
		}

		const tile = this._config.tileSize;
		const radius = this._config.radius;
		const feetY = this._mesh.position.y - tile / 2;

		if (moveX !== 0) {
			const targetX = this._mesh.position.x + moveX;
			if (this._terrain.getMaxHeightAround(targetX, this._mesh.position.z, radius) <= feetY + tile) {
				this._mesh.position.x = targetX;
			}
		}
		if (moveZ !== 0) {
			const targetZ = this._mesh.position.z + moveZ;
			if (this._terrain.getMaxHeightAround(this._mesh.position.x, targetZ, radius) <= feetY + tile) {
				this._mesh.position.z = targetZ;
			}
		}
	}

	private _applyVerticalMovement(): void {
		if (this._input.isPressed('Space') && this._isGrounded) {
			this._velocityY = this._config.jumpForce;
			this._isGrounded = false;
		}

		this._velocityY += this._config.gravity;
		this._mesh.position.y += this._velocityY;

		const ground = this._terrain.getMaxHeightAround(
			this._mesh.position.x, this._mesh.position.z, this._config.radius,
		);
		const floor = ground + this._config.tileSize / 2 + 0.5;

		if (this._mesh.position.y <= floor) {
			this._mesh.position.y = floor;
			this._velocityY = 0;
			this._isGrounded = true;
		}
	}
}
