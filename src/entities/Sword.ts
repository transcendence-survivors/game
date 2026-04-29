import {
	AbstractMesh, ImportMeshAsync, Scene, TransformNode, Vector3,
} from '@babylonjs/core';
import '@babylonjs/loaders/OBJ';
import { SwingAnimation } from '../combat/SwingAnimation';

export type GripAxis = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';

export interface SwordConfig {
	rootUrl: string;
	fileName: string;
	offset: Vector3;
	restRotation: Vector3;
	scale: number;
	gripAxis: GripAxis;
	swingDurationMs: number;
	swingFromAngle: number;
	swingToAngle: number;
	hitWindowStart: number;
	hitWindowEnd: number;
}

export class Sword {
	private readonly _scene: Scene;
	private readonly _config: SwordConfig;
	private readonly _root: TransformNode;
	private readonly _swingPivot: TransformNode;
	private readonly _swing: SwingAnimation;

	private _onHitFrame: (() => void) | null = null;
	private _loaded: boolean = false;

	constructor(scene: Scene, parent: TransformNode, config: SwordConfig) {
		this._scene = scene;
		this._config = config;

		this._root = new TransformNode('swordRoot', scene);
		this._root.parent = parent;
		this._root.position = config.offset.clone();
		this._root.rotation = config.restRotation.clone();

		this._swingPivot = new TransformNode('swordSwingPivot', scene);
		this._swingPivot.parent = this._root;
		this._swingPivot.scaling = new Vector3(config.scale, config.scale, config.scale);

		this._swing = new SwingAnimation({
			fromAngle: config.swingFromAngle,
			toAngle: config.swingToAngle,
			durationMs: config.swingDurationMs,
			hitWindowStart: config.hitWindowStart,
			hitWindowEnd: config.hitWindowEnd,
		});
	}

	get root(): TransformNode {
		return this._root;
	}

	get isLoaded(): boolean {
		return this._loaded;
	}

	onHit(callback: () => void): void {
		this._onHitFrame = callback;
	}

	swing(nowMs: number): boolean {
		return this._swing.start(nowMs);
	}

	update(nowMs: number): void {
		if (this._swing.isActive(nowMs)) {
			this._root.rotation.y = this._swing.angleAt(nowMs);
		} else {
			this._root.rotation.y = this._config.restRotation.y;
		}

		if (this._swing.consumeHitFrame(nowMs) && this._onHitFrame) {
			this._onHitFrame();
		}
	}

	async load(): Promise<void> {
		const result = await ImportMeshAsync(
			`${this._config.rootUrl}${this._config.fileName}`,
			this._scene,
		);
		const ownedMeshes: AbstractMesh[] = [];
		for (const mesh of result.meshes) {
			if (!mesh.parent) {
				mesh.parent = this._swingPivot;
				ownedMeshes.push(mesh);
			}
			mesh.isPickable = false;
		}
		this._alignGripToPivot(ownedMeshes);
		this._loaded = true;
	}

	dispose(): void {
		this._root.dispose();
	}

	private _alignGripToPivot(meshes: AbstractMesh[]): void {
		if (meshes.length === 0) return;

		let min = new Vector3(Infinity, Infinity, Infinity);
		let max = new Vector3(-Infinity, -Infinity, -Infinity);

		for (const mesh of meshes) {
			const bb = mesh.getBoundingInfo().boundingBox;
			const meshMin = bb.minimum.add(mesh.position);
			const meshMax = bb.maximum.add(mesh.position);
			min = Vector3.Minimize(min, meshMin);
			max = Vector3.Maximize(max, meshMax);
		}

		const offset = new Vector3(0, 0, 0);
		switch (this._config.gripAxis) {
			case '+x': offset.x = -min.x; break;
			case '-x': offset.x = -max.x; break;
			case '+y': offset.y = -min.y; break;
			case '-y': offset.y = -max.y; break;
			case '+z': offset.z = -min.z; break;
			case '-z': offset.z = -max.z; break;
		}

		for (const mesh of meshes) {
			mesh.position.addInPlace(offset);
		}
	}
}
