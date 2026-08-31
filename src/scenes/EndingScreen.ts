import * as GUI from '@babylonjs/gui';
import * as BABYLON from '@babylonjs/core';
import * as COLYSEUS from '@colyseus/sdk';
import type { GameState } from '../../../shared-package/src';
import { guiImports } from '../assets/ui';
import { SceneManager } from './SceneManager';
import type { PlayerStats } from '../../../shared-package/src/schemas/GameState';
import { iconsImport } from '../assets/icons';

interface StatDef {
	key: keyof PlayerStats;
	label: string;
	icon: string;
	format?: (v: number) => string;
}

const STAT_DEFS: StatDef[] = [
	{ key: 'attackDamage', label: 'Damage', icon: iconsImport.damage },
	{
		key: 'attackSpeed',
		label: 'Attack Speed',
		icon: iconsImport.attackSpeed,
		format: (v) => `${v.toFixed(2)}/s`,
	},
	{ key: 'moveSpeed', label: 'Move Speed', icon: iconsImport.moveSpeed },
	{ key: 'armor', label: 'Armor', icon: iconsImport.armor },
	{
		key: 'lifesteal',
		label: 'Lifesteal',
		icon: iconsImport.lifesteal,
		format: (v) => `${v}%`,
	},
	{ key: 'range', label: 'Range', icon: iconsImport.range },
	{ key: 'maxHealth', label: 'Max Health', icon: iconsImport.maxHealth },
];

export class EndingScreen {
	private advTex!: GUI.AdvancedDynamicTexture;
	private engine: BABYLON.Engine;
	private room!: COLYSEUS.Room<GameState>;
	private scene: BABYLON.Scene;
	public readonly ready: Promise<void>;

	constructor(engine: BABYLON.Engine, room: COLYSEUS.Room<GameState>) {
		this.engine = engine;
		this.scene = new BABYLON.Scene(this.engine);
		new BABYLON.FreeCamera(
			'EndingScreenCam',
			BABYLON.Vector3.Zero(),
			this.scene,
		);
		this.room = room;
		this.ready = this.show();
	}

	async render() {
		this.scene.render();
	}

	async show() {
		this.advTex = GUI.AdvancedDynamicTexture.CreateFullscreenUI(
			'EndingScreen',
			true,
			this.scene,
		);
		this.advTex.idealWidth = 1920;
		this.advTex.idealHeight = 1080;
		this.advTex.renderAtIdealSize = true;
		await this.advTex.parseFromURLAsync(guiImports.endingScreen);
		this.fillStats();
		this.connectButton();
	}

	dispose() {
		this.advTex.dispose();
		this.scene.dispose();
	}

	private fillStats() {
		const stats = this.room.state.players.get(this.room.sessionId)?.stats;
		if (!stats) {
			return;
		}
		STAT_DEFS.forEach((def, i) => {
			const icon = this.advTex.getControlByName(
				`Stat_${i + 1}_img`,
			) as GUI.Image;

			const text = this.advTex.getControlByName(
				`Stat_${i + 1}_txt`,
			) as GUI.TextBlock;

			if (!icon || !text) {
				return;
			}

			icon.source = def.icon;
			const rawValue = stats[def.key] as number;
			text.text = `${def.label}: ${def.format ? def.format(rawValue) : rawValue}`;
		});
	}

	private connectButton() {
		const button = this.advTex.getControlByName(
			'BackToLobby',
		) as GUI.Button;

		button.onPointerDownObservable.add(() => SceneManager.toLobby());
	}
}
