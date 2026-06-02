/**
 * @file Visual representation of a single player as a colored cube.
 *
 * Pure view — no input, no networking. The mesh's position is pushed by the
 * {@link PlayerRegistry} whenever the server broadcasts a state update.
 *
 * Server snapshots arrive at the Colyseus `patchRate` (~20 Hz). Snapping the
 * mesh on every snapshot would produce a visible stutter at 60 fps render.
 * Instead, snapshots set a *target* and each render frame eases the mesh
 * toward it (exponential smoothing). The local player still benefits because
 * the server is authoritative and only echoes positions every patch — local
 * inputs do not predict ahead of the snapshot.
 */

import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';

export class PlayerEntity {
	private readonly mesh: Mesh;
	private readonly target = new Vector3();
	/**
	 * Convergence rate (per second) of the position lerp. Higher = snappier but
	 * also closer to a raw snap; lower = smoother but more visibly lagging
	 * behind the server. Sourced from {@link RenderConfig.interpRate}.
	 */
	private readonly interpRate: number;

	constructor(id: string, scene: Scene, colorHex: string, interpRate: number) {
		this.mesh = CreateBox(`player-${id}`, { size: 1 }, scene);
		const mat = new StandardMaterial(`player-${id}-mat`, scene);
		mat.diffuseColor = Color3.FromHexString(colorHex);
		this.mesh.material = mat;
		this.interpRate = interpRate;
	}

	/**
	 * Snap both the rendered position and the interpolation target to (x, y, z).
	 * Used at spawn — there is nothing to interpolate from yet.
	 */
	snapTo(x: number, y: number, z: number): void {
		this.mesh.position.set(x, y, z);
		this.target.set(x, y, z);
	}

	/** Update the interpolation target. The mesh eases toward it each frame. */
	setTarget(x: number, y: number, z: number): void {
		this.target.set(x, y, z);
	}

	/**
	 * Advance the position lerp by one render frame.
	 *
	 * `1 - exp(-rate * dt)` is the standard framerate-independent smoothing
	 * factor — same convergence regardless of whether we tick at 30 or 240 fps.
	 */
	tickInterpolation(dtSec: number): void {
		const alpha = 1 - Math.exp(-this.interpRate * dtSec);
		const p = this.mesh.position;
		p.x += (this.target.x - p.x) * alpha;
		p.y += (this.target.y - p.y) * alpha;
		p.z += (this.target.z - p.z) * alpha;
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
