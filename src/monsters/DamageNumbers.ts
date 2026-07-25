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

interface Floater {
	text: GUI.TextBlock;
	anchor: BABYLON.TransformNode;
	elapsed: number;
}

/**
 * Nombres de dégâts flottants, pilotés par les événements serveur
 * (`monsterDamage`). Chaque nombre est ancré à un point du monde — la position
 * du monstre au moment du coup — puis monte et s'estompe. Étant indépendant du
 * cycle de vie du monstre, le coup fatal s'affiche même si l'entité a déjà été
 * retirée de l'état.
 */
export class DamageNumbers {
	private scene: BABYLON.Scene;
	private ui: GUI.AdvancedDynamicTexture;
	private floaters: Floater[] = [];

	constructor(scene: BABYLON.Scene, ui: GUI.AdvancedDynamicTexture) {
		this.scene = scene;
		this.ui = ui;
	}

	spawn(
		position: BABYLON.Vector3,
		amount: number,
		isBoss: boolean,
		fatal: boolean,
	) {
		const rounded = Math.round(amount);
		if (rounded <= 0) return;

		const anchor = new BABYLON.TransformNode('dmgAnchor', this.scene);
		anchor.position.copyFrom(position);

		const text = new GUI.TextBlock('dmg', `-${rounded}`);
		text.color = fatal ? FATAL_COLOR : COLOR;
		text.fontSize = isBoss ? BOSS_FONT_SIZE : FONT_SIZE;
		text.fontWeight = 'bold';
		text.outlineColor = 'black';
		text.outlineWidth = 4;
		text.resizeToFit = true;
		this.ui.addControl(text);
		text.linkWithMesh(anchor);
		text.linkOffsetX = (Math.random() - 0.5) * JITTER_PX;
		text.linkOffsetY = START_OFFSET_PX;

		this.floaters.push({ text, anchor, elapsed: 0 });
	}

	/** Anime les nombres actifs : montée + fondu, puis suppression. */
	update(deltaTime: number) {
		for (let i = this.floaters.length - 1; i >= 0; i--) {
			const floater = this.floaters[i];
			floater.elapsed += deltaTime;
			const t = floater.elapsed / LIFETIME_S;
			if (t >= 1) {
				floater.text.dispose();
				floater.anchor.dispose();
				this.floaters.splice(i, 1);
				continue;
			}
			floater.text.linkOffsetY = START_OFFSET_PX - RISE_PX * t;
			floater.text.alpha = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
		}
	}

	dispose() {
		this.floaters.forEach((floater) => {
			floater.text.dispose();
			floater.anchor.dispose();
		});
		this.floaters.length = 0;
	}
}
