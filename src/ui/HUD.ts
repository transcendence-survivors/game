import { Scene } from '@babylonjs/core';
import {
	AdvancedDynamicTexture, Control, Rectangle, StackPanel, TextBlock,
} from '@babylonjs/gui';
import type { HealthSystem } from '../systems/HealthSystem';

export class HUD {
	private readonly _ui: AdvancedDynamicTexture;
	private readonly _hpBarFill: Rectangle;
	private readonly _hpText: TextBlock;
	private readonly _gameOverText: TextBlock;
	private readonly _fpsText: TextBlock;
	private readonly _enemyCountText: TextBlock;

	constructor(scene: Scene) {
		this._ui = AdvancedDynamicTexture.CreateFullscreenUI('UI', true, scene);
		const { fill, text } = this._buildHpBar();
		this._hpBarFill = fill;
		this._hpText = text;
		this._gameOverText = this._buildGameOverText();
		const stats = this._buildStatsPanel();
		this._fpsText = stats.fps;
		this._enemyCountText = stats.enemies;
	}

	bindHealth(health: HealthSystem): void {
		this._renderHp(health.current, health.max);
		health.onChange((current, max) => this._renderHp(current, max));
	}

	showGameOver(): void {
		this._gameOverText.isVisible = true;
	}

	updateFps(fps: number): void {
		this._fpsText.text = `FPS: ${fps.toFixed()}`;
	}

	updateEnemyCount(count: number, max: number): void {
		this._enemyCountText.text = `Enemies: ${count} / ${max}`;
	}

	private _renderHp(current: number, max: number): void {
		this._hpText.text = `${current} / ${max}`;
		const ratio = max === 0 ? 0 : current / max;
		this._hpBarFill.width = `${ratio * 100}%`;
		if (ratio > 0.5) this._hpBarFill.background = 'green';
		else if (ratio > 0.2) this._hpBarFill.background = 'orange';
		else this._hpBarFill.background = 'red';
	}

	private _buildHpBar(): { fill: Rectangle; text: TextBlock } {
		const container = new Rectangle();
		container.width = '300px';
		container.height = '40px';
		container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
		container.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
		container.left = '20px';
		container.top = '-20px';
		container.thickness = 2;
		container.background = 'black';
		container.color = 'white';
		this._ui.addControl(container);

		const fill = new Rectangle();
		fill.width = '100%';
		fill.height = '100%';
		fill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
		fill.background = 'green';
		fill.thickness = 0;
		container.addControl(fill);

		const text = new TextBlock();
		text.color = 'white';
		text.fontSize = 20;
		text.fontWeight = 'bold';
		container.addControl(text);

		return { fill, text };
	}

	private _buildGameOverText(): TextBlock {
		const t = new TextBlock('gameOverText');
		t.text = 'GAME OVER';
		t.color = 'red';
		t.fontSize = 72;
		t.fontWeight = 'bold';
		t.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
		t.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
		t.isVisible = false;
		this._ui.addControl(t);
		return t;
	}

	private _buildStatsPanel(): { fps: TextBlock; enemies: TextBlock } {
		const panel = new StackPanel();
		panel.width = '200px';
		panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
		panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
		panel.top = '20px';
		panel.left = '-20px';
		this._ui.addControl(panel);

		const fps = new TextBlock();
		fps.text = 'FPS: 0';
		fps.color = 'yellow';
		fps.fontSize = 22;
		fps.fontWeight = 'bold';
		fps.height = '30px';
		fps.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
		panel.addControl(fps);

		const enemies = new TextBlock();
		enemies.text = 'Enemies: 0';
		enemies.color = 'orange';
		enemies.fontSize = 22;
		enemies.fontWeight = 'bold';
		enemies.height = '30px';
		enemies.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
		panel.addControl(enemies);

		return { fps, enemies };
	}
}
