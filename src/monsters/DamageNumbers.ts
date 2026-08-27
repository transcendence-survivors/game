import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';

const LIFETIME_S = 0.9;
const RISE_PX = 58;
const START_OFFSET_PX = -8;
const JITTER_PX = 26;
const FONT_SIZE = 22;
const BOSS_FONT_SIZE = 32;
const COLOR = '#ffe14d';
const FATAL_COLOR = '#ff5a3c';
const ELITE_COLOR = '#f6c445';
const MAX_VISIBLE_FLOATERS = 72;

interface Floater {
	text: GUI.TextBlock;
	anchor: BABYLON.TransformNode;
	elapsed: number;
}

export class DamageNumbers {
	private readonly scene: BABYLON.Scene;
	private readonly ui: GUI.AdvancedDynamicTexture;
	private readonly floaters: Floater[] = [];
	private readonly pool: Floater[] = [];

	constructor(scene: BABYLON.Scene, ui: GUI.AdvancedDynamicTexture) {
		this.scene = scene;
		this.ui = ui;
	}

	spawn(
		position: BABYLON.Vector3,
		amount: number,
		isBoss: boolean,
		fatal: boolean,
		isElite = false,
	): void {
		const rounded = Math.round(amount);
		if (rounded <= 0) return;
		if (
			this.floaters.length >= MAX_VISIBLE_FLOATERS &&
			!fatal &&
			!isBoss &&
			!isElite
		)
			return;

		const floater = this.pool.pop() ?? this.createFloater();
		const { anchor, text } = floater;
		anchor.position.copyFrom(position);
		floater.elapsed = 0;
		text.text = `-${rounded}`;
		text.color = fatal ? FATAL_COLOR : isElite ? ELITE_COLOR : COLOR;
		text.fontSize = isBoss ? BOSS_FONT_SIZE : isElite ? 26 : FONT_SIZE;
		text.linkOffsetX = (Math.random() - 0.5) * JITTER_PX;
		text.linkOffsetY = START_OFFSET_PX;
		text.alpha = 1;
		text.isVisible = true;

		this.floaters.push(floater);
	}

	update(deltaTime: number): void {
		for (let i = this.floaters.length - 1; i >= 0; i--) {
			const floater = this.floaters[i];
			floater.elapsed += deltaTime;
			const t = floater.elapsed / LIFETIME_S;
			if (t >= 1) {
				floater.text.isVisible = false;
				const last = this.floaters.pop()!;
				if (i < this.floaters.length) this.floaters[i] = last;
				this.pool.push(floater);
				continue;
			}
			floater.text.linkOffsetY = START_OFFSET_PX - RISE_PX * t;
			floater.text.alpha = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
		}
	}

	dispose(): void {
		for (const floater of this.floaters) this.disposeFloater(floater);
		for (const floater of this.pool) this.disposeFloater(floater);
		this.floaters.length = 0;
		this.pool.length = 0;
	}

	private createFloater(): Floater {
		const anchor = new BABYLON.TransformNode('dmgAnchor', this.scene);
		const text = new GUI.TextBlock('dmg');
		text.fontWeight = 'bold';
		text.outlineColor = 'black';
		text.outlineWidth = 4;
		text.resizeToFit = true;
		this.ui.addControl(text);
		text.linkWithMesh(anchor);
		return { text, anchor, elapsed: 0 };
	}

	private disposeFloater(floater: Floater): void {
		floater.text.dispose();
		floater.anchor.dispose();
	}
}
