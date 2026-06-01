/**
 * @file Visual representation of a single player as a colored cube.
 *
 * Pure view — no input, no networking. The mesh's position is pushed by the
 * {@link PlayerRegistry} whenever the server broadcasts a state update.
 */

import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';

export class PlayerEntity {
	private readonly mesh: Mesh;

	constructor(id: string, scene: Scene, colorHex: string) {
		this.mesh = CreateBox(`player-${id}`, { size: 1 }, scene);
		const mat = new StandardMaterial(`player-${id}-mat`, scene);
		mat.diffuseColor = Color3.FromHexString(colorHex);
		this.mesh.material = mat;
	}

	/** Snap the cube to the given world position (server-authoritative). */
	setPosition(x: number, y: number, z: number): void {
		this.mesh.position.set(x, y, z);
	}

	/** Read the cube's current world position (for camera follow, etc.). */
	get position(): Readonly<Vector3> {
		return this.mesh.position;
	}

	/** Remove the mesh from the scene and free its GPU resources. */
	dispose(): void {
		this.mesh.material?.dispose();
		this.mesh.dispose();
	}
}
