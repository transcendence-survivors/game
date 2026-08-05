import * as GUI from '@babylonjs/gui';
import * as BABYLON from '@babylonjs/core';
import * as COLYSEUS from '@colyseus/sdk';
import type { GameState } from '../../../shared-package';
import { guiImports } from '../assets/ui';

export class Hud {
	private advTex!: GUI.AdvancedDynamicTexture;
	private room!: COLYSEUS.Room<GameState>;
	private scene: BABYLON.Scene;
	public readonly ready: Promise<void>;

	constructor(
		_engine: BABYLON.Engine,
		scene: BABYLON.Scene,
		room: COLYSEUS.Room<GameState>,
	) {
		this.scene = scene;
		this.room = room;
		this.ready = this.show();
	}

	async show() {
		this.advTex = GUI.AdvancedDynamicTexture.CreateFullscreenUI(
			'Hud',
			true,
			this.scene,
		);
		this.advTex.idealWidth = 1920;
		this.advTex.idealHeight = 1080;
		this.advTex.renderAtIdealSize = true;
		await this.advTex.parseFromURLAsync(guiImports.hud);
	}

	dispose() {
		this.advTex.dispose();
	}

	update() {
		const hpBar = this.advTex.getControlByName(
			'HealthBarFill',
		) as GUI.Rectangle;
		const hpText = this.advTex.getControlByName(
			'HealthBarText',
		) as GUI.TextBlock;
		const xpBar = this.advTex.getControlByName(
			'XPBarFill',
		) as GUI.Rectangle;
		const killText = this.advTex.getControlByName(
			'KillCounterText',
		) as GUI.TextBlock;

		if (!hpBar || !hpText || !xpBar || !killText) {
			console.error('Missing controls from hud.json', {
				hpBar,
				hpText,
				xpBar,
				killText,
			});
			return;
		}
		const player = this.room.state.players.get(this.room.sessionId);
		if (!player) return;
		const { current, max } = player.life;
		const MAX_FILL_PERCENT = 98;
		const hpRatio = max > 0 ? Math.min(1, Math.max(0, current / max)) : 0;
		hpBar.width = `${(hpRatio * MAX_FILL_PERCENT).toFixed(2)}%`;
		hpText.text = `${Math.round(current)} / ${Math.round(max)}`;

		const MAX_XP_FILL_PERCENT = 98;
		const { xp, xpToNextLevel } = player.experience;
		const xpRatio =
			xpToNextLevel > 0
				? Math.min(1, Math.max(0, xp / xpToNextLevel))
				: 0;
		xpBar.width = `${(xpRatio * MAX_XP_FILL_PERCENT).toFixed(2)}%`;
		killText.text = `Kills: ${player.stats.killAmount}`;
	}
}
