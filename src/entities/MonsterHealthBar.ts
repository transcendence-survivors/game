import {
	Mesh, MeshBuilder, Scene, Vector3,
} from '@babylonjs/core';
import { AdvancedDynamicTexture, Rectangle } from '@babylonjs/gui';

export interface MonsterHealthBarConfig {
	width: number;
	height: number;
	heightOffset: number;
}

export class MonsterHealthBar {
	private readonly _plane: Mesh;
	private readonly _texture: AdvancedDynamicTexture;
	private readonly _fill: Rectangle;

	constructor(scene: Scene, parent: Mesh, config: MonsterHealthBarConfig) {
		this._plane = MeshBuilder.CreatePlane('hpBarPlane', {
			width: config.width,
			height: config.height,
		}, scene);
		this._plane.parent = parent;
		this._plane.position = new Vector3(0, config.heightOffset, 0);
		this._plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
		this._plane.isPickable = false;

		this._texture = AdvancedDynamicTexture.CreateForMesh(this._plane, 256, 32);

		const background = new Rectangle();
		background.width = 1;
		background.height = 1;
		background.background = 'black';
		background.color = 'white';
		background.thickness = 4;
		this._texture.addControl(background);

		this._fill = new Rectangle();
		this._fill.width = 1;
		this._fill.height = 1;
		this._fill.background = 'lime';
		this._fill.thickness = 0;
		this._fill.horizontalAlignment = Rectangle.HORIZONTAL_ALIGNMENT_LEFT;
		background.addControl(this._fill);
	}

	setRatio(ratio: number): void {
		const clamped = Math.max(0, Math.min(1, ratio));
		this._fill.width = clamped;
		if (clamped > 0.5) this._fill.background = 'lime';
		else if (clamped > 0.2) this._fill.background = 'orange';
		else this._fill.background = 'red';
	}

	dispose(): void {
		this._texture.dispose();
		this._plane.dispose();
	}
}
